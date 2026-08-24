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
import { isUntouchedSampleTrainings } from '../utils/sampleTrainings';
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
      // Training Center now starts 100% empty — no pre-filled starter list —
      // so the user and their leader build the plan from scratch. Accounts
      // that still have the old, never-customized starter placeholders (some
      // stuck on stale 2024 dates from an earlier bug, showing as hundreds of
      // days past due) get them cleared out here, on every app load, so it's
      // fixed everywhere (Dashboard, the app-wide GlobalPastDueModal) — not
      // only if the user happens to visit /training. Any false "past due"
      // penalty already charged for a placeholder is refunded.
      if (isUntouchedSampleTrainings(profile.trainings)) {
        try {
          await setDoc(doc(db, 'users', uid), { trainings: [] }, { merge: true });
          const refunded = profile.trainings.filter(t => t.pastDuePenaltyApplied);
          if (refunded.length) {
            await setDoc(doc(db, 'users', uid), { penaltyPoints: increment(-refunded.length) }, { merge: true });
            for (const t of refunded) {
              await logPointEvent(uid, {
                points: 1,
                toolLabel: 'Training Past Due Penalty Refunded',
                reason: `Refunded false past-due penalty for "${t.title}" (starter placeholder removed)`,
              });
            }
            calculateScore(uid).catch(() => {});
          }
          profile = { ...profile, trainings: [] };
        } catch { /* ignore */ }
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
