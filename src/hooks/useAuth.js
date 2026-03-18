import { useState, useEffect } from 'react';
import { auth, googleProvider, isConfigured } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isConfigured);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    import('firebase/auth').then(({ onAuthStateChanged }) => {
      const unsub = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      // Store cleanup
      window.__authUnsub = unsub;
    });

    return () => window.__authUnsub?.();
  }, []);

  async function login() {
    if (!isConfigured || !auth) {
      setAuthError('Firebase is not configured. Add your Firebase config to .env.local');
      return;
    }

    setAuthError(null);
    try {
      const { signInWithPopup, signOut } = await import('firebase/auth');
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message);
      }
    }
  }

  async function logout() {
    if (!auth) return;
    setAuthError(null);
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }

  return { user, loading, authError, login, logout, isConfigured };
}
