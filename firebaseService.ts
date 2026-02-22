
import { Expense, ReconciliationReport, TravelLog } from './types';

const getSDK = () => {
  const sdk = (window as any).FirebaseSDK;
  if (!sdk) return null;
  return sdk;
};

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

export const subscribeToTravelLogs = (callback: (logs: TravelLog[]) => void, onError?: (error: string) => void) => {
  const sdk = getSDK();
  if (!sdk) return () => { };
  const { db, collection, query, orderBy, onSnapshot } = sdk;
  const q = query(collection(db, 'travel_logs'), orderBy('start_date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    const logs = snapshot.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as TravelLog);
    callback(logs);
  }, (error: any) => onError?.(error.message));
};

const calculateDuration = (start: string, end?: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end || start);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const addTravelLogs = async (logs: Omit<TravelLog, 'id'>[]) => {
  console.log(`🔥 Firebase: addTravelLogs called for ${logs.length} items`);
  const sdk = getSDK();
  if (!sdk) return;
  const { db, collection, addDoc, getDocs, query, where, doc, setDoc } = sdk;

  const initialResults: any[] = [];
  const sortedLogs = [...logs].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Pre-fetch all logs to check for duplicates
  const existingLogsSnap = await getDocs(collection(db, 'travel_logs'));
  const existingLogs = existingLogsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TravelLog));

  for (const log of sortedLogs) {
    // 1. DEDUPLICATION CHECK
    const isDuplicate = existingLogs.some(existing => {
      if (log.reference_number && existing.reference_number &&
        log.reference_number.toUpperCase() === existing.reference_number.toUpperCase()) return true;
      const sameDate = log.start_date === existing.start_date;
      const sameDest = (log.destination_city || "").toLowerCase() === (existing.destination_city || "").toLowerCase();
      if (sameDate && sameDest && log.travel_type === existing.travel_type) return true;
      return false;
    });

    if (isDuplicate) continue;

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
  const sdk = getSDK();
  if (!sdk) return () => { };
  const { db, collection, query, orderBy, onSnapshot } = sdk;
  const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as Expense));
  });
};

export const subscribeToTelegramReceipts = (callback: (expenses: Expense[]) => void) => {
  const sdk = getSDK();
  if (!sdk) return () => { };
  const { db, collection, query, orderBy, onSnapshot } = sdk;
  const q = query(collection(db, 'telegram_receipts'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot: any) => {
    callback(snapshot.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as Expense));
  });
};

export const addExpenses = async (expenses: Omit<Expense, 'id'>[]) => {
  const sdk = getSDK();
  if (!sdk) return;
  const { db, collection, addDoc, getDocs } = sdk;

  // Deduplication: Pre-fetch current month's expenses for safety
  const snap = await getDocs(collection(db, 'expenses'));
  const existing = snap.docs.map(d => d.data() as Expense);

  const results = [];
  for (const exp of expenses) {
    const isDup = existing.some(e =>
      e.merchant.toLowerCase() === exp.merchant.toLowerCase() &&
      Math.abs(e.amount - exp.amount) < 0.01 &&
      e.date === exp.date
    );
    if (!isDup) {
      const docRef = await addDoc(collection(db, 'expenses'), sanitize({ ...exp, created_at: new Date().toISOString() }));
      results.push({ id: docRef.id, ...exp });
    }
  }
  return results;
};

export const updateExpense = async (id: string, updates: Partial<Expense>) => {
  const sdk = getSDK();
  if (!sdk) return;
  const { db, doc, setDoc } = sdk;
  return await setDoc(doc(db, 'expenses', id), sanitize(updates), { merge: true });
};

export const removeExpense = async (id: string) => {
  const sdk = getSDK();
  if (!sdk) return;
  const { db, doc, deleteDoc } = sdk;
  return await deleteDoc(doc(db, 'expenses', id));
};

export const saveReportToCloud = async (report: ReconciliationReport) => {
  const sdk = getSDK();
  if (!sdk) return;
  const { db, collection, addDoc } = sdk;
  return await addDoc(collection(db, 'reports'), sanitize({ ...report, created_at: new Date().toISOString() }));
};

export const fetchReportsFromCloud = async (year?: number) => {
  const sdk = getSDK();
  if (!sdk) return [];
  const { db, collection, query, where, getDocs } = sdk;
  const q = year ? query(collection(db, 'reports'), where('year', '==', year)) : query(collection(db, 'reports'));
  const snap = await getDocs(q);
  return snap.docs.map((doc: any) => sanitize({ id: doc.id, ...doc.data() }) as ReconciliationReport).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.year, 11, 31).getTime());
};
