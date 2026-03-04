import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebaseService';

export interface UserSession {
  uid: string;
  email: string;
  loginTime: number;
  isAdmin?: boolean;
}

export const signUp = async (email: string, password: string, _recoveryPhrase?: string): Promise<UserSession> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Note: Recovery phrase is now handled by Firebase reset emails by default, 
  // but we can store it in Firestore later if specific multi-factor logic is needed.

  const session = {
    uid: user.uid,
    email: user.email || '',
    loginTime: Date.now(),
    isAdmin: false
  };
  localStorage.setItem('expenseflow_session', JSON.stringify(session));
  return session;
};

export const signIn = async (email: string, password: string): Promise<UserSession> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Force refresh token to get latest custom claims (admin status)
  const idTokenResult = await user.getIdTokenResult(true);
  const isAdmin = !!idTokenResult.claims.admin;

  const session = {
    uid: user.uid,
    email: user.email || '',
    loginTime: Date.now(),
    isAdmin
  };
  localStorage.setItem('expenseflow_session', JSON.stringify(session));
  return session;
};

export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const signOut = async () => {
  await firebaseSignOut(auth);
  localStorage.removeItem('expenseflow_session');
};

export const getSession = (): UserSession | null => {
  const data = localStorage.getItem('expenseflow_session');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// Listener for auth state changes to keep session in sync
export const subscribeToAuth = (callback: (session: UserSession | null) => void) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const idTokenResult = await user.getIdTokenResult();
      const session = {
        uid: user.uid,
        email: user.email || '',
        loginTime: Date.now(),
        isAdmin: !!idTokenResult.claims.admin
      };
      localStorage.setItem('expenseflow_session', JSON.stringify(session));
      callback(session);
    } else {
      localStorage.removeItem('expenseflow_session');
      callback(null);
    }
  });
};