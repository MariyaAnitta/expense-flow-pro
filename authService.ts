import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from './firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserSession {
  uid: string;
  email: string;
  loginTime: number;
  isAdmin?: boolean;
  role: 'admin' | 'employee';
}

export const signUp = async (email: string, password: string, _recoveryPhrase?: string): Promise<UserSession> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create Firestore user profile
  await setDoc(doc(db, 'authorized_users', user.uid), {
    email: user.email,
    role: 'employee',
    createdAt: new Date().toISOString()
  });

  const session = {
    uid: user.uid,
    email: user.email || '',
    loginTime: Date.now(),
    isAdmin: false,
    role: 'employee' as const
  };
  localStorage.setItem('expenseflow_session', JSON.stringify(session));
  return session;
};

export const signIn = async (email: string, password: string): Promise<UserSession> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Fetch role from Firestore
  let userDoc = await getDoc(doc(db, 'authorized_users', user.uid));

  // If user profile doesn't exist (e.g., legacy user), create it now
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'authorized_users', user.uid), {
      email: user.email,
      role: 'employee',
      createdAt: new Date().toISOString()
    });
    userDoc = await getDoc(doc(db, 'authorized_users', user.uid));
  }

  const userData = userDoc.data();
  const isAdmin = userData?.role === 'admin';

  const session = {
    uid: user.uid,
    email: user.email || '',
    loginTime: Date.now(),
    isAdmin,
    role: (userData?.role || 'employee') as 'admin' | 'employee'
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
      // Fetch/Create role in Firestore
      let userDoc = await getDoc(doc(db, 'authorized_users', user.uid));

      if (!userDoc.exists()) {
        await setDoc(doc(db, 'authorized_users', user.uid), {
          email: user.email || '',
          role: 'employee',
          createdAt: new Date().toISOString()
        });
        userDoc = await getDoc(doc(db, 'authorized_users', user.uid));
      }

      const userData = userDoc.data();
      const session = {
        uid: user.uid,
        email: user.email || '',
        loginTime: Date.now(),
        isAdmin: userData?.role === 'admin',
        role: (userData?.role || 'employee') as 'admin' | 'employee'
      };
      localStorage.setItem('expenseflow_session', JSON.stringify(session));
      callback(session);
    } else {
      localStorage.removeItem('expenseflow_session');
      callback(null);
    }
  });
};