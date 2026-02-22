/**
 * CURRENCY SERVICE
 * Handles fetching exchange rates and converting amounts to a base currency (INR).
 * Caches rates for 24 hours to ensure performance and offline resilience.
 */

const CACHE_KEY = 'expenseflow_exchange_rates';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const BASE_URL = 'https://api.exchangerate-api.com/v4/latest/INR';

export interface ExchangeRates {
  rates: Record<string, number>;
  timestamp: number;
}

export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
  // Check cache first
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const parsed: ExchangeRates = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed;
    }
  }

  // Fetch fresh rates
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    
    const data = await response.json();
    const ratesData: ExchangeRates = {
      rates: data.rates,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(ratesData));
    return ratesData;
  } catch (error) {
    console.error('Currency Service Error:', error);
    // Return cached data even if expired if we're offline/error
    return cached ? JSON.parse(cached) : null;
  }
};

export const convertToINR = (amount: number, fromCurrency: string, rates: Record<string, number>): number => {
  const currency = fromCurrency.toUpperCase();
  
  // If already INR, return as is
  if (currency === 'INR') return amount;
  
  // 1 INR = rates[currency]
  // So amount_in_inr = amount / rates[currency]
  const rate = rates[currency];
  if (!rate) {
    console.warn(`No exchange rate found for ${currency}. Using 1:1 fallback.`);
    return amount;
  }
  
  return amount / rate;
};
