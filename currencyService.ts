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

/**
 * Fetches the official exchange rate for a specific month.
 * Logic: Checks session -> Checks localStorage -> Fetches from API.
 * The API always returns current live rates, which effectively becomes the "Fixed Rate"
 * for whichever month the app is currently running in when it first fetches.
 * For historical mismatch (e.g. looking at a 2023 receipt), if there is no cache,
 * it will pull today's rate and lock it as that month's rate.
 */
export const getExchangeRates = async (dateStr?: string): Promise<ExchangeRates | null> => {
  const monthKey = getMonthKey(dateStr);
  const cacheKey = `expenseflow_rates_${monthKey}`;

  // 1. Check in-memory session cache
  if (currentSessionRates[monthKey]) {
    return currentSessionRates[monthKey];
  }

  // 2. Check persistent localStorage cache
  const cachedContent = localStorage.getItem(cacheKey);
  if (cachedContent) {
    try {
      const parsed: ExchangeRates = JSON.parse(cachedContent);
      currentSessionRates[monthKey] = parsed; // Add to session cache
      return parsed;
    } catch (e) {
      console.warn('Failed to parse cached rates', e);
    }
  }

  // 3. Fetch fresh rates and permanently lock them for this monthKey
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await response.json();
    const ratesData: ExchangeRates = {
      rates: data.rates,
      timestamp: Date.now(),
    };

    localStorage.setItem(cacheKey, JSON.stringify(ratesData));
    currentSessionRates[monthKey] = ratesData;
    return ratesData;
  } catch (error) {
    console.error(`Currency Service Error for ${monthKey}:`, error);

    // 4. Fallback: If offline/failed, try to find ANY recent cached month
    const fallbackKey = Object.keys(localStorage).find(k => k.startsWith('expenseflow_rates_'));
    if (fallbackKey) {
      const fallbackData = localStorage.getItem(fallbackKey);
      if (fallbackData) return JSON.parse(fallbackData);
    }
    return null;
  }
};

/**
 * Normalizes any amount to USD ($) using the specific month's rate.
 * The `rates` parameter can now be a Dictionary of monthly rates, or a single rate object.
 * To support legacy code that just passes a single `rates` object, we check the structure.
 */
export const convertToUSD = (amount: number, fromCurrency: string, ratesData: any, referenceDate?: string): number => {
  const currency = fromCurrency.toUpperCase();
  if (currency === 'USD') return amount;

  // Determine correct rates to use based on the input structure
  let activeRates: Record<string, number> = {};

  if (ratesData && ratesData[getMonthKey(referenceDate)]?.rates) {
    // It's a dictionary of monthly rates { "2026-03": { rates: {...} } }
    activeRates = ratesData[getMonthKey(referenceDate)].rates;
  } else if (ratesData && ratesData.rates) {
    // It's a single straight ExchangeRates object
    activeRates = ratesData.rates;
  } else if (ratesData) {
    // It's just the raw rates record
    activeRates = ratesData;
  }

  const rate = activeRates[currency];
  if (!rate) {
    // Fallback if rate is missing for that specific currency
    return amount;
  }

  return amount / rate;
};

// Legacy support for internal mapping if needed
export const convertToINR = (amount: number, fromCurrency: string, rates: Record<string, number>): number => {
  const usd = convertToUSD(amount, fromCurrency, rates);
  const inrRate = rates['INR'] || 83; // Fallback to current avg
  return usd * inrRate;
};
