import { Expense, ReconciliationReport, TravelLog, AppSettings, UsageLog } from './types';
import { getSession } from './authService';

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  where,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const sanitize = (data: any, seen = new WeakSet()): any => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString();
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (seen.has(data)) return undefined;
  seen.add(data);
  if (Array.isArray(data)) return data.map(item => sanitize(item, seen)).filter(item => item !== undefined);
  const sanitized: any = {};
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'function' || key.startsWith('__')) return;
    const value = data[key];
    const sanitizedValue = sanitize(value, seen);
    if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
  });
  return sanitized;
};

export const isHomeLocation = (log: any) => {
  const dest = `${log.destination_country || ""} ${log.destination_city || ""}`.toLowerCase();
  return /uae|emirates|dubai|united arab emirates/.test(dest);
};

const mapExpenseData = (data: any): Expense => {
  const sanitized = sanitize(data);
  return {
    ...sanitized,
    category: sanitized.category || sanitized.cat || 'General',
    confidence: sanitized.confidence === undefined ? 1.0 : sanitized.confidence,
    needs_clarification: sanitized.needs_clarification || false
  } as Expense;
};


const calculateDuration = (start: string, end?: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end || start);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const addTravelLogs = async (logs: Omit<TravelLog, 'id'>[]) => {
  console.log(`🔥 Firebase: addTravelLogs called for ${logs.length} items`);

  const initialResults: any[] = [];
  const sortedLogs = [...logs].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Pre-fetch all logs to check for duplicates
  const existingLogsSnap = await getDocs(collection(db, 'travel_logs'));
  const existingLogs = existingLogsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TravelLog));

  for (const log of sortedLogs) {
    // 1. DEDUPLICATION CHECK (Per-User)
    const isDuplicate = existingLogs.some(existing => {
      const sameUser = log.user_id === existing.user_id;
      if (!sameUser) return false;

      if (log.reference_number && existing.reference_number &&
        log.reference_number.toUpperCase() === existing.reference_number.toUpperCase()) return true;
      const sameDate = log.start_date === existing.start_date;
      const sameDest = (log.destination_city || "").toLowerCase() === (existing.destination_city || "").toLowerCase();
      if (sameDate && sameDest && log.travel_type === existing.travel_type) return true;
      return false;
    });

    if (isDuplicate) {
      console.log(`⚠️ Firebase: Skipping duplicate Travel Log for user ${log.user_id}: ${log.destination_city} at ${log.start_date}`);
      continue;
    }

    const isAccommodation = log.travel_type === 'accommodation';
    const isHome = isHomeLocation(log);

    const documentDuration = calculateDuration(log.start_date, log.end_date);
    // A trip is a consolidated round trip if the AI provided a return/end date, even if same day.
    const isRoundTrip = !isAccommodation && !isHome && !!log.return_date;

    const newLog = {
      ...log,
      uploaded_at: new Date().toISOString(),
      days_spent: (isHome || isRoundTrip || isAccommodation) ? documentDuration : 1,
      status: (isHome || isRoundTrip || isAccommodation) ? 'Complete' : 'Open - Awaiting return',
      hotel_verification_status: !isAccommodation && !isHome ? 'missing' : 'not_required'
    };

    const docRef = await addDoc(collection(db, 'travel_logs'), sanitize(newLog));
    initialResults.push({ id: docRef.id, ...newLog });
  }

  // 2. Global Integration Sweep (Forensic Check-in/Check-out window)
  const freshLogsSnap = await getDocs(collection(db, 'travel_logs'));
  const allLogs = freshLogsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TravelLog));

  const flights = allLogs.filter(l => l.travel_type === 'flight');
  const hotels = allLogs.filter(l => l.travel_type === 'accommodation');

  // Verify Hotels
  for (const flight of flights) {
    if (flight.hotel_verification_status === 'verified' || isHomeLocation(flight)) continue;

    const match = hotels.find(hotel => {
      // Forensic Match: City + Date Window (-1 to +2 days)
      const flightCity = (flight.destination_city || "").toLowerCase();
      const hotelCity = (hotel.destination_city || "").toLowerCase();
      const cityMatch = flightCity.includes(hotelCity) || hotelCity.includes(flightCity);

      const fDate = new Date(flight.start_date).getTime();
      const hDate = new Date(hotel.start_date).getTime();
      const diffDays = (hDate - fDate) / (1000 * 60 * 60 * 24);
      const dateMatch = diffDays >= -1 && diffDays <= 2; // -1 to +2 window

      return cityMatch && dateMatch && (!hotel.linked_flight_id || hotel.linked_flight_id === flight.id);
    });

    if (match) {
      await setDoc(doc(db, 'travel_logs', flight.id), sanitize({
        hotel_verification_status: 'verified',
        linked_hotel_id: match.document_id || match.id,
        updated_at: new Date().toISOString()
      }), { merge: true });

      await setDoc(doc(db, 'travel_logs', match.id), sanitize({
        status: 'Complete',
        linked_flight_id: flight.id,
        hotel_verification_status: 'verified',
        updated_at: new Date().toISOString()
      }), { merge: true });
    }
  }

  // 3. Bridge Flights (Linking Outbound to Return)
  // CRITICAL: "Return-First" Strategy
  // We process arrivals to Home (Dubai) and pair them with the NEAREST PRECEDING outbound flight.

  const arrivals = allLogs
    .filter(l => l.travel_type === 'flight' && isHomeLocation(l))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const openOutbounds = allLogs
    .filter(l => l.status === 'Open - Awaiting return' && !isHomeLocation(l))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  for (const arrival of arrivals) {
    if (arrival.outbound_flight_id) continue; // Already bridged

    // Find the NEAREST PRECEDING outbound flight that isn't bridged yet
    const outbound = [...openOutbounds].reverse().find(o =>
      new Date(o.start_date) <= new Date(arrival.start_date) && !o.return_flight_id
    );

    if (outbound) {
      const start = new Date(outbound.start_date);
      const end = new Date(arrival.start_date);
      // Inclusive days
      const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      await setDoc(doc(db, 'travel_logs', outbound.id), sanitize({
        status: 'Complete',
        return_date: arrival.start_date,
        return_flight_id: arrival.id,
        days_spent: days,
        updated_at: new Date().toISOString()
      }), { merge: true });

      await setDoc(doc(db, 'travel_logs', arrival.id), sanitize({
        outbound_flight_id: outbound.id,
        updated_at: new Date().toISOString()
      }), { merge: true });

      // Update local state to prevent double-bridging in loop
      outbound.return_flight_id = arrival.id;
      arrival.outbound_flight_id = outbound.id;
    }
  }

  return initialResults;
};

export const subscribeToExpenses = (callback: (expenses: Expense[]) => void) => {
  const session = getSession();
  if (!session) return () => { };
  const q = query(
    collection(db, 'expenses'),
    where('user_id', 'in', [session.email, 'SHARED_POOL'])
  );
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => mapExpenseData({ id: doc.id, ...doc.data() })));
  });
};

// --- ADMIN ONLY METHODS ---
export const subscribeToAllExpenses = (callback: (expenses: (Expense & { owner_email?: string })[]) => void) => {
  const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    const expenses = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return { ...mapExpenseData({ id: doc.id, ...data }), owner_email: data.user_id } as (Expense & { owner_email?: string });
    });
    callback(expenses);
  });
};

export const subscribeToAllTravelLogs = (callback: (logs: (TravelLog & { owner_email?: string })[]) => void) => {
  const q = query(collection(db, 'travel_logs'), orderBy('start_date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return sanitize({ id: doc.id, ...data, owner_email: data.user_id }) as (TravelLog & { owner_email?: string });
    }));
  });
};

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  const settingsRef = doc(db, 'global_settings', 'audit_config');
  return onSnapshot(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as AppSettings);
    } else {
      callback({ audit_threshold: 10, custom_expense_heads: [] }); // Default fallback
    }
  });
};

export const updateSettings = async (updates: Partial<AppSettings>) => {
  const settingsRef = doc(db, 'global_settings', 'audit_config');
  return await setDoc(settingsRef, { ...updates, updated_at: new Date().toISOString() }, { merge: true });
};

export const subscribeToAllTelegramReceipts = (callback: (expenses: (Expense & { owner_email?: string })[]) => void) => {
  const q = query(collection(db, 'telegram_receipts'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return { ...mapExpenseData({ id: doc.id, ...data }), owner_email: data.user_id } as (Expense & { owner_email?: string });
    }));
  });
};

export const verifyExpense = async (id: string, updates: { accountant_category: string, verified_amount: number }) => {
  return await setDoc(doc(db, 'expenses', id), sanitize({
    ...updates,
    is_verified: true,
    verified_at: new Date().toISOString()
  }), { merge: true });
};

export const subscribeToTelegramReceipts = (callback: (expenses: Expense[]) => void) => {
  const session = getSession();
  if (!session) return () => { };
  const q = query(
    collection(db, 'telegram_receipts'),
    where('user_id', 'in', [session.email, 'SHARED_POOL'])
  );
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => mapExpenseData({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToTravelLogs = (callback: (logs: TravelLog[]) => void) => {
  const session = getSession();
  if (!session) return () => { };
  const q = query(
    collection(db, 'travel_logs'),
    where('user_id', 'in', [session.email, 'SHARED_POOL'])
  );
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as TravelLog));
  });
};

export const logReceiptUsage = async (id: string, userEmail: string, action: string = 'Reconciled') => {
  const receiptRef = doc(db, 'expenses', id);
  const log: UsageLog = {
    user: userEmail,
    date: new Date().toISOString(),
    action: action
  };

  return await setDoc(receiptRef, {
    usage_history: arrayUnion(log),
    reconciled_by: userEmail,
    reconciled_at: new Date().toISOString()
  }, { merge: true });
};

export const logTravelUsage = async (id: string, userEmail: string, action: string = 'Viewed') => {
  const logRef = doc(db, 'travel_logs', id);
  const log: UsageLog = {
    user: userEmail,
    date: new Date().toISOString(),
    action: action
  };

  return await setDoc(logRef, {
    usage_history: arrayUnion(log)
  }, { merge: true });
};

export const addExpenses = async (expenses: Omit<Expense, 'id'>[]) => {

  // Deduplication: Pre-fetch current month's expenses for safety
  const snap = await getDocs(collection(db, 'expenses'));
  const existing = snap.docs.map(d => d.data() as Expense);

  const results = [];
  for (const exp of expenses) {
    const isDup = existing.some(e =>
      e.user_id === exp.user_id && // Per-User Check
      e.merchant.toLowerCase() === exp.merchant.toLowerCase() &&
      Math.abs(e.amount - exp.amount) < 0.01 &&
      e.date === exp.date
    );
    if (!isDup) {
      const docRef = await addDoc(collection(db, 'expenses'), sanitize({ ...exp, created_at: new Date().toISOString() }));
      results.push({ id: docRef.id, ...exp });
    } else {
      console.log(`⚠️ Firebase: Skipping duplicate Expense for user ${exp.user_id}: ${exp.merchant} - ${exp.amount} at ${exp.date}`);
    }
  }
  return results;
};

export const updateExpense = async (id: string, updates: Partial<Expense>) => {
  return await setDoc(doc(db, 'expenses', id), sanitize(updates), { merge: true });
};

export const removeExpense = async (id: string) => {
  return await deleteDoc(doc(db, 'expenses', id));
};

export const saveReportToCloud = async (report: ReconciliationReport) => {
  const session = getSession();
  return await addDoc(collection(db, 'reports'), sanitize({
    ...report,
    user_id: session?.email,
    created_at: new Date().toISOString()
  }));
};

export const fetchReportsFromCloud = async (year?: number, email?: string) => {
  const session = getSession();
  if (!session) return [];

  let q = query(collection(db, 'reports'));

  if (session.role !== 'admin') {
    // Employees can only see their own reports
    q = query(q, where('user_id', '==', session.email));
  } else if (email && email !== 'All Employees') {
    // Admin can filter by specific employee
    q = query(q, where('user_id', '==', email));
  }

  if (year) {
    q = query(q, where('year', '==', year));
  }

  const snap = await getDocs(q);
  return snap.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as ReconciliationReport)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
};

export const subscribeToReports = (callback: (reports: ReconciliationReport[]) => void, year?: number, email?: string) => {
  const session = getSession();
  if (!session) {
    callback([]);
    return () => { };
  }

  let q = query(collection(db, 'reports'));

  if (session.role !== 'admin') {
    // Employees can only see their own reports
    q = query(q, where('user_id', '==', session.email));
  } else if (email && email !== 'All Employees') {
    // Admin can filter by specific employee
    q = query(q, where('user_id', '==', email));
  }

  if (year) {
    q = query(q, where('year', '==', year));
  }

  return onSnapshot(q, (snapshot: any) => {
    const reports = snapshot.docs.map((doc: any) => sanitize({
      id: doc.id,
      ...doc.data()
    }) as ReconciliationReport)
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
    callback(reports);
  }, (error) => {
    console.error("Reports subscription error:", error);
    callback([]);
  });
};
export const subscribeToAuthorizedUsers = (callback: (users: string[]) => void) => {
  const q = query(collection(db, 'authorized_users'));
  return onSnapshot(q, (snapshot: any) => {
    const users = snapshot.docs.map((doc: any) => doc.data().email as string).filter(Boolean);
    const uniqueUsers = Array.from(new Set(users)) as string[];
    callback(uniqueUsers.sort());
  });
};
