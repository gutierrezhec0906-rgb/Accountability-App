import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { auth, db } from '../firebase';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (EMAILJS_PUBLIC_KEY) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

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
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);

    // Send welcome email via EmailJS (non-blocking — failure won't break signup)
    console.log('EmailJS vars:', { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY });
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: email,
          to_name: displayName,
          role: role || 'Leader',
          status: isFirst ? 'full access' : 'pending approval',
          is_first: isFirst ? 'true' : 'false',
        },
      ).then(() => console.log('EmailJS: sent OK'))
       .catch((err) => console.error('EmailJS error:', JSON.stringify(err)));
    }

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
      if (snap.exists()) setUserProfile(snap.data());
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
