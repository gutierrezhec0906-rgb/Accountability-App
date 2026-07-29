import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Personal, per-user "remembered names" list — every owner/coachee/mentor name
// the current account has ever saved across the app (Visual Board, LOB, Lean
// follow-ups, Coaching, Mentoring, Problem Solving A3, …), stored once on
// users/{uid}.savedNames and reused everywhere as autocomplete suggestions.
// This is intentionally personal to the account, not shared across the company.
const MAX_SAVED_NAMES = 200;

export function useSavedNames() {
  const { currentUser } = useAuth();
  const [names, setNames] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const saved = snap.exists() ? (snap.data().savedNames || []) : [];
        setNames(saved);
      } catch { /* ignore — autocomplete is a nice-to-have, never block saving */ }
      setLoaded(true);
    })();
  }, [currentUser]);

  // Add a name to the remembered list (call this when a record is actually
  // saved, not on every keystroke). Case-insensitive de-dup, alphabetical.
  const remember = useCallback((name) => {
    const trimmed = (name || '').trim();
    if (!trimmed || !currentUser) return;
    setNames(prev => {
      if (prev.some(n => n.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed].sort((a, b) => a.localeCompare(b)).slice(0, MAX_SAVED_NAMES);
      setDoc(doc(db, 'users', currentUser.uid), { savedNames: next }, { merge: true }).catch(() => {});
      return next;
    });
  }, [currentUser]);

  return { names, loaded, remember };
}
