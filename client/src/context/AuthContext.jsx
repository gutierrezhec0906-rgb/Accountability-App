import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { buildSampleTrainings } from '../utils/sampleTrainings';
import { logPointEvent, calculateScore } from '../utils/scoring';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, displayName, role) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    // First user ever becomes admin + auto-approved
    const usersSnap = await getDocs(collection(db, 'users'));
    const isFirst = usersSnap.empty;

    const profile = {
      uid: cred.user.uid,
      email,
      displayName,
      role: role || 'Leader',
      createdAt: serverTimestamp(),
      scores: {},
      status: isFirst ? 'approved' : 'pending',
      isAdmin: isFirst,
      // Legal consent captured at registration.
      termsAcceptedAt: serverTimestamp(),
      termsVersion: '2026-07-27',
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);

    return cred;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function fetchProfile(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return;
      let profile = snap.data();
      // Backfill companyName for accounts whose companyId was set before this
      // field existed (or set directly, bypassing CompleteProfile) — otherwise
      // the sidebar/profile UI has nothing to show even though companyId is set.
      if (profile.companyId && !profile.companyName) {
        try {
          const companySnap = await getDoc(doc(db, 'companies', profile.companyId));
          const companyName = companySnap.exists() ? companySnap.data().name : '';
          if (companyName) {
            await setDoc(doc(db, 'users', uid), { companyName }, { merge: true });
            profile = { ...profile, companyName };
          }
        } catch { /* ignore */ }
      }
      // One-time repair for accounts seeded before the hardcoded-2024-date
      // Training Center bug was fixed: those sample trainings are still stuck
      // on 2024 due dates, showing as hundreds of days past due everywhere
      // (Dashboard, the app-wide GlobalPastDueModal), not just on the Training
      // Center page itself — so this has to run on every app load, not only
      // when the user happens to visit /training. Detects untouched seed items
      // (matching title + a stale 2024-* dueDate), re-baselines them relative
      // to today, and refunds any false "past due" penalty already charged.
      if (Array.isArray(profile.trainings) && profile.trainings.length) {
        const freshSample = buildSampleTrainings();
        const staleIds = [];
        const repaired = profile.trainings.map(t => {
          const fresh = freshSample.find(f => f.id === t.id && f.title === t.title);
          if (fresh && typeof t.dueDate === 'string' && t.dueDate.startsWith('2024-')) {
            staleIds.push(t.id);
            return { ...fresh, recommitmentCount: t.recommitmentCount || 0 };
          }
          return t;
        });
        if (staleIds.length) {
          try {
            await setDoc(doc(db, 'users', uid), { trainings: repaired }, { merge: true });
            const refunded = profile.trainings.filter(t => staleIds.includes(t.id) && t.pastDuePenaltyApplied);
            if (refunded.length) {
              await setDoc(doc(db, 'users', uid), { penaltyPoints: increment(-refunded.length) }, { merge: true });
              for (const t of refunded) {
                await logPointEvent(uid, {
                  points: 1,
                  toolLabel: 'Training Past Due Penalty Refunded',
                  reason: `Refunded false past-due penalty for "${t.title}" (stale seed data bug)`,
                });
              }
              calculateScore(uid).catch(() => {});
            }
            profile = { ...profile, trainings: repaired };
          } catch { /* ignore */ }
        }
      }
      setUserProfile(profile);
    } catch (e) {
      console.warn('Could not fetch profile', e);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) await fetchProfile(user.uid);
      else setUserProfile(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = { currentUser, userProfile, signup, login, logout, fetchProfile };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
