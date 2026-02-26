
/// <reference types="vite/client" />
import { Expense, ExpenseSource, TravelLog } from "./types";

const isProd = import.meta.env.PROD;
const API_BASE_URL = isProd ? "/api" : "http://localhost:3001/api";

// Helper to handle API errors
async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.statusText}`);
  }
  return response.json();
}


/**
 * Calls the Genkit Agent backend to extract data from multiple documents in one batch.
 */
export const batchExtractAllData = async (
  inputs: Array<{ content: string | { data: string; mimeType: string }, source: ExpenseSource }>,
  bankName?: string
): Promise<{ expenses: Expense[], travelLogs: TravelLog[] }> => {

  const payloadInputs = inputs.map(input => {
    let payloadContent: string;
    if (typeof input.content === 'string') {
      payloadContent = input.content;
    } else {
      payloadContent = JSON.stringify(input.content);
    }
    return { content: payloadContent, source: input.source };
  });

  const body = JSON.stringify({ inputs: payloadInputs });
  console.log("Frontend Batch Payload (first 100 bytes):", body.substring(0, 100));

  try {
    const result = await fetch(`${API_BASE_URL}/generate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }).then(handleApiResponse);

    console.log("Frontend Batch Result:", result);

    const allExpenses: Expense[] = [];
    const allTravelLogs: TravelLog[] = [];

    // result.results is the array of ExtractionOutputSchema results
    (result.results || []).forEach((batchItem: any, batchIdx: number) => {
      const source = inputs[batchIdx].source;

      const expenses = (batchItem.expenses || []).map((item: any, index: number) => ({
        id: `${source}-${Date.now()}-${batchIdx}-${index}`,
        merchant: item.m || "Unknown",
        amount: Number(item.a) || 0,
        currency: item.c || "AED",
        date: item.d || new Date().toISOString().split('T')[0],
        category: item.cat || "General",
        description: source === 'bank_statement' || source === 'credit_card_statement' ? `${bankName || 'BANK'} TRANSACTION` : "PROOF DOCUMENT",
        bank: bankName,
        source,
        confidence: 1.0,
        created_at: new Date().toISOString(),
        items: item.items,
        tax_amount: item.tax_amount,
        main_category: item.main_category,
        company_project: item.company_project,
        reimbursement_status: item.reimbursement_status,
        paid_by: item.paid_by,
        payment_method: item.payment_method,
        notes: item.notes
      }));

      const docId = `doc-${Date.now()}-${batchIdx}`;

      // Aggressive Consolidation: Merge ALL flight logs from this document into one.
      const rawLogs = (batchItem.travel_logs || []);
      const flightLogsRaw = rawLogs.filter((l: any) => l.type === 'flight');
      const hotelLogsRaw = rawLogs.filter((l: any) => l.type === 'accommodation');

      const consolidatedFlights: any[] = [];
      if (flightLogsRaw.length > 0) {
        // Merge everything into the first record
        const main = { ...flightLogsRaw[0] };
        flightLogsRaw.slice(1).forEach((l: any) => {
          if (new Date(l.date) < new Date(main.date)) main.date = l.date;
          if (!main.end_date || (l.end_date && new Date(l.end_date) > new Date(main.end_date))) {
            main.end_date = l.end_date || l.date;
          }
          if (main.dest_city === 'Dubai' || !main.dest_city) main.dest_city = l.dest_city;
          if (main.dest_country === 'UAE' || !main.dest_country) main.dest_country = l.dest_country;
        });
        consolidatedFlights.push(main);
      }

      const travelLogs = [...consolidatedFlights, ...hotelLogsRaw].map((log: any, index: number) => ({
        id: `travel-${Date.now()}-${batchIdx}-${index}`,
        destination_city: log.dest_city || "",
        destination_country: log.dest_country || "",
        start_date: log.date,
        end_date: log.end_date || log.date,
        departure_date: log.date,
        return_date: log.end_date || null,
        provider_name: log.provider,
        travel_type: log.type as 'flight' | 'accommodation',
        reference_number: log.ref || "",
        guest_name: log.guest || "",
        status: 'Complete' as any,
        days_spent: 0,
        document_id: docId
      }));

      allExpenses.push(...expenses);
      allTravelLogs.push(...travelLogs);
    });

    return { expenses: allExpenses, travelLogs: allTravelLogs };

  } catch (error) {
    console.error("Batch Agent Extraction Failed:", error);
    throw error;
  }
};

/**
 * Calls the Genkit Agent backend to extract data from the provided content.
 * Refactored to use the batch endpoint for consistency and retry logic.
 */
export const extractAllData = async (
  content: string | { data: string; mimeType: string },
  source: ExpenseSource,
  bankName?: string
): Promise<{ expenses: Expense[], travelLogs: TravelLog[] }> => {
  return batchExtractAllData([{ content, source }], bankName);
};

/**
 * Calls the Genkit Agent backend to reconcile transactions.
 */
export const reconcileData = async (expenses: Expense[]) => {
  try {
    const result = await fetch(`${API_BASE_URL}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenses })
    }).then(handleApiResponse);

    return result; // Expected: { matched: [], unmatchedReceipts: [], ... }
  } catch (error) {
    console.error("Agent Reconciliation Failed:", error);
    throw error;
  }
};

