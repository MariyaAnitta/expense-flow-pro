import bcrypt from 'bcryptjs';

const getSDK = () => (window as any).FirebaseSDK;

export interface UserSession {
  email: string;
  loginTime: number;
}

const SALT_ROUNDS = 10;

export const signUp = async (email: string, password: string, recoveryPhrase: string): Promise<UserSession> => {
  const sdk = getSDK();
  if (!sdk) throw new Error("Firebase not initialized");

  const { db, doc, getDoc, setDoc } = sdk;
  const userRef = doc(db, 'authorized_users', email.toLowerCase());
  
  // Check if user exists
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    throw new Error("User already exists");
  }

  // Hash credentials
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Store recovery phrase in a way that's easy to verify but not entirely plain (trim and lowercase)
  const normalizedRecovery = recoveryPhrase.trim().toLowerCase();

  const userData = {
    email: email.toLowerCase(),
    passwordHash,
    recoveryPhrase: normalizedRecovery,
    createdAt: new Date().toISOString()
  };

  await setDoc(userRef, userData);

  const session = { email: email.toLowerCase(), loginTime: Date.now() };
  localStorage.setItem('expenseflow_session', JSON.stringify(session));
  return session;
};

export const signIn = async (email: string, password: string): Promise<UserSession> => {
  const sdk = getSDK();
  if (!sdk) throw new Error("Firebase not initialized");

  const { db, doc, getDoc } = sdk;
  const userRef = doc(db, 'authorized_users', email.toLowerCase());
  
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found");
  }

  const userData = userSnap.data();
  const isMatch = await bcrypt.compare(password, userData.passwordHash);

  if (!isMatch) {
    throw new Error("Invalid password");
  }

  const session = { email: email.toLowerCase(), loginTime: Date.now() };
  localStorage.setItem('expenseflow_session', JSON.stringify(session));
  return session;
};

export const resetPassword = async (email: string, recoveryPhrase: string, newPassword: string): Promise<void> => {
  const sdk = getSDK();
  if (!sdk) throw new Error("Firebase not initialized");

  const { db, doc, getDoc, setDoc } = sdk;
  const userRef = doc(db, 'authorized_users', email.toLowerCase());
  
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found");
  }

  const userData = userSnap.data();
  const normalizedInput = recoveryPhrase.trim().toLowerCase();

  if (userData.recoveryPhrase !== normalizedInput) {
    throw new Error("Incorrect recovery phrase");
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await setDoc(userRef, { 
    ...userData, 
    passwordHash: newPasswordHash,
    updatedAt: new Date().toISOString()
  });
};

export const signOut = () => {
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