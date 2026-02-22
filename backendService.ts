
import { ReconciliationReport } from './types';
import { saveReportToCloud, fetchReportsFromCloud } from './firebaseService';

/**
 * DEEP SANITIZATION HELPER
 * Ensures objects are serializable for LocalStorage and free of circularity.
 * Fixed: No longer strips properties based on key length (which removed 'id').
 */
const sanitizeForStorage = (data: any, seen = new WeakSet()): any => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  
  if (seen.has(data)) return undefined;
  
  if (data instanceof Date) return data.toISOString();
  if (typeof data.toDate === 'function') return data.toDate().toISOString();

  if (Array.isArray(data)) {
    seen.add(data);
    return data.map(item => sanitizeForStorage(item, seen)).filter(i => i !== undefined);
  }

  seen.add(data);
  const sanitized: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      // Filter out functions and internal private keys
      if (typeof data[key] === 'function' || key.startsWith('__')) continue;
      const val = sanitizeForStorage(data[key], seen);
      if (val !== undefined) sanitized[key] = val;
    }
  }
  return sanitized;
};

const getLocalReports = (year?: number): (ReconciliationReport & { is_local?: boolean })[] => {
  try {
    const data = localStorage.getItem('expenseflow_local_reports');
    const reports = data ? JSON.parse(data) : [];
    return year ? reports.filter((r: any) => r.year === year) : reports;
  } catch (e) {
    console.error("Local storage read error", e);
    return [];
  }
};

export const saveReconciliation = async (report: ReconciliationReport): Promise<void> => {
  try {
    await saveReportToCloud(report);
  } catch (error: any) {
    console.warn('Firebase save restricted, using LocalStorage fallback.');
    const reports = JSON.parse(localStorage.getItem('expenseflow_local_reports') || '[]');
    const sanitizedReport = sanitizeForStorage({ ...report, id: `local-${Date.now()}`, is_local: true });
    reports.unshift(sanitizedReport);
    localStorage.setItem('expenseflow_local_reports', JSON.stringify(reports));
    
    if (error.message === 'PERMISSION_DENIED') {
      window.dispatchEvent(new CustomEvent('firestore-permission-error'));
    }
  }
};

export const getReconciliations = async (year?: number): Promise<(ReconciliationReport & { is_local?: boolean })[]> => {
  try {
    const cloudReports = await fetchReportsFromCloud(year);
    const localReports = getLocalReports(year);
    return [...cloudReports, ...localReports];
  } catch (error: any) {
    console.warn('Firebase fetch restricted, showing LocalStorage only.');
    if (error.message === 'PERMISSION_DENIED') {
      window.dispatchEvent(new CustomEvent('firestore-permission-error'));
    }
    return getLocalReports(year);
  }
};
