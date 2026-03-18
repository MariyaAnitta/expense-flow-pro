/**
 * CURRENCY SERVICE
 * Handles fetching exchange rates and converting amounts to USD.
 * Uses Option 2: Monthly Fixed Rates to ensure reconciliation stability.
 */

const BASE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

export interface ExchangeRates {
  rates: Record<string, number>;
  timestamp: number;
}

// Global cache for the current session to prevent repetitive localStorage hits
const currentSessionRates: Record<string, ExchangeRates> = {};

/**
 * Gets the YYYY-MM string for a given date, defaulting to today.
 */
const getMonthKey = (dateStr?: string): string => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

import { getMonthlyRates, saveMonthlyRates } from './firebaseService';

/**
 * Fetches the official exchange rate for a specific month.
 * Logic: Checks session -> Checks Firestore -> Fetches from API -> Syncs to Firestore.
 * This ensures that the first user to visit the app in a new month "pins" the 
 * rates for the entire organization for that monthKey.
 */
export const getExchangeRates = async (dateStr?: string): Promise<ExchangeRates | null> => {
  const monthKey = getMonthKey(dateStr);
  const cacheKey = `expenseflow_rates_${monthKey}`;

  // 1. Check in-memory session cache (Fastest)
  if (currentSessionRates[monthKey]) {
    return currentSessionRates[monthKey];
  }

  // 2. Check Firestore (Organization-Wide Pinned Rates)
  try {
    const pinnedRates = await getMonthlyRates(monthKey);
    if (pinnedRates) {
      const ratesData: ExchangeRates = {
        rates: pinnedRates.rates,
        timestamp: pinnedRates.timestamp
      };
      currentSessionRates[monthKey] = ratesData;
      localStorage.setItem(cacheKey, JSON.stringify(ratesData)); // Local sync
      return ratesData;
    }
  } catch (e) {
    console.warn('Firestore rate lookup failed, falling back to local/API', e);
  }

  // 3. Fallback: Check persistent localStorage cache (Offline/Local)
  const cachedContent = localStorage.getItem(cacheKey);
  if (cachedContent) {
    try {
      const parsed: ExchangeRates = JSON.parse(cachedContent);
      currentSessionRates[monthKey] = parsed;
      return parsed;
    } catch (e) {
      console.warn('Failed to parse cached rates', e);
    }
  }

  // 4. Final: Fetch fresh rates and PIN THEM for the entire organization
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await response.json();
    const ratesData: ExchangeRates = {
      rates: data.rates,
      timestamp: Date.now(),
    };

    // Pin for everyone
    await saveMonthlyRates(monthKey, ratesData);
    
    // Sync local
    localStorage.setItem(cacheKey, JSON.stringify(ratesData));
    currentSessionRates[monthKey] = ratesData;
    return ratesData;
  } catch (error) {
    console.error(`Currency Service Error for ${monthKey}:`, error);

    // 5. Emergency Fallback: Find ANY recent cached month in localStorage
    const fallbackKey = Object.keys(localStorage).find(k => k.startsWith('expenseflow_rates_'));
    if (fallbackKey) {
      const fallbackData = localStorage.getItem(fallbackKey);
      if (fallbackData) return JSON.parse(fallbackData);
    }
    return null;
  }
};

/**
 * Gets the currency symbol for the given code.
 */
export const getCurrencySymbol = (code: string): string => {
  const symbols: Record<string, string> = {
    'USD': '$',
    'AED': 'د.إ',
    'OMR': 'ر.ع.',
    'SAR': 'ر.س',
    'INR': '₹',
    'EUR': '€',
    'GBP': '£'
  };
  return symbols[code.toUpperCase()] || code;
};

/**
 * List of supported reporting currencies.
 */
export const getSupportedCurrencies = () => ['USD', 'AED', 'OMR', 'SAR', 'INR', 'EUR', 'GBP'];

/**
 * Normalizes any amount to a target Base Currency using the specific month's rate.
 * Uses USD as the bridge currency for maximum stability.
 */
export const convertToBaseCurrency = (
  amount: number,
  fromCurrency: string,
  targetCurrency: string,
  ratesData: any,
  referenceDate?: string
): number => {
  const from = fromCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();

  if (from === target) return amount;

  // Determine correct rates to use based on the input structure
  let activeRates: Record<string, number> = {};
  const monthKey = getMonthKey(referenceDate);

  if (ratesData && ratesData[monthKey]?.rates) {
    activeRates = ratesData[monthKey].rates;
  } else if (ratesData && ratesData.rates) {
    activeRates = ratesData.rates;
  } else if (ratesData) {
    activeRates = ratesData;
  }

  // 1. Convert "from" to USD bridge
  let amountInUSD = amount;
  if (from !== 'USD') {
    const fromRate = activeRates[from];
    if (fromRate) amountInUSD = amount / fromRate;
  }

  // 2. Convert USD bridge to "target"
  if (target === 'USD') return amountInUSD;

  const targetRate = activeRates[target];
  if (!targetRate) return amountInUSD; // Fallback to USD if target rate missing

  return amountInUSD * targetRate;
};

/**
 * Legacy support / Wrapper for existing USD-dependent code
 */
export const convertToUSD = (amount: number, fromCurrency: string, ratesData: any, referenceDate?: string): number => {
  return convertToBaseCurrency(amount, fromCurrency, 'USD', ratesData, referenceDate);
};

