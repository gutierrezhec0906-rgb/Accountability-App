import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
