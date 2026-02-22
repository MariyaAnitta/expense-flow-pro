import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { genkit, z } from 'genkit';
import { vertexAI, gemini20Flash } from '@genkit-ai/vertexai';
import { logError } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the Vite build directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📥 INCOMING: ${req.method} ${req.url}`);
    if (Object.keys(req.body).length > 0) {
        console.log(`[${timestamp}] 📦 Payload keys: ${Object.keys(req.body).join(', ')}`);
    }
    next();
});

app.get('/', (req, res) => res.send('Genkit Vertex Server Running (Gemini 2.0 Flash)'));

// --- RETRY UTILITY ---
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
            if (isQuotaError && i < maxRetries - 1) {
                // Wait 5s, then 20s, then 80s... (Exponential base 4)
                const delay = Math.pow(4, i + 1) * 5000 + Math.random() * 2000;
                console.warn(`[Retry] Quota hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries reached');
}

// --- GENKIT INIT ---
// Smart credential detection: supports both inline JSON and file path
let credentials: object | undefined;
try {
    const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credsJson) {
        // Preferred: explicit JSON variable
        credentials = JSON.parse(credsJson);
        console.log('[Auth] Using GOOGLE_CREDENTIALS_JSON');
    } else if (credsEnv && credsEnv.trim().startsWith('{')) {
        // Fallback: GOOGLE_APPLICATION_CREDENTIALS contains JSON text (not a path)
        credentials = JSON.parse(credsEnv);
        console.log('[Auth] Using inline JSON from GOOGLE_APPLICATION_CREDENTIALS');
    } else {
        console.log('[Auth] Using keyfile from GOOGLE_APPLICATION_CREDENTIALS path');
    }
} catch (e) {
    console.warn('[Auth] Could not parse credentials JSON:', e);
}

const ai = genkit({
    plugins: [
        vertexAI({
            location: process.env.VITE_GOOGLE_CLOUD_LOCATION || 'us-east1',
            projectId: process.env.VITE_GOOGLE_CLOUD_PROJECT || 'sivak-485711',
            googleAuth: credentials
                ? { credentials }
                : { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
        })
    ],
    model: gemini20Flash,
});

// --- HELPERS ---
function toParts(content: string): any[] {
    const preview = content.substring(0, 100).replace(/\n/g, ' ');
    console.log(`[Helper] toParts processing: "${preview}..."`);

    try {
        const trimmed = content.trim();
        // Handle double-stringified JSON (happens if JSON.stringify is called too many times)
        let jsonStr = trimmed;
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            try { jsonStr = JSON.parse(trimmed); } catch (e) { }
        }

        if (jsonStr.startsWith('{')) {
            const parsed = JSON.parse(jsonStr);
            if (parsed.data && parsed.mimeType) {
                console.log(`[Helper] 📸 MULTIMODAL SUCCESS: Found ${parsed.mimeType} (base64 snippet: ${parsed.data.substring(0, 20)}...)`);
                const url = parsed.data.startsWith('data:') ? parsed.data : `data:${parsed.mimeType};base64,${parsed.data}`;
                return [{ media: { url, contentType: parsed.mimeType } }];
            } else {
                console.warn(`[Helper] ⚠️ JSON detected but keys mismatch: ${Object.keys(parsed).join(', ')}`);
            }
        }
    } catch (e) {
        // Not JSON or parse failed
    }

    console.log(`[Helper] 📝 Falling back to Text part.`);
    return [{ text: content }];
}

// --- SCHEMAS ---
const TravelLogSchema = z.object({
    type: z.enum(['flight', 'accommodation']),
    provider: z.string().describe("Airline or Hotel Name"),
    dest_city: z.string().describe("Destination City (or city of stay)"),
    dest_country: z.string().describe("Destination Country (or country of stay)"),
    date: z.string().describe("Check-in or Departure Date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("Check-out or Return Flight Date (YYYY-MM-DD)"),
    ref: z.string().optional().describe("PNR or Booking Ref"),
    guest: z.string().optional().describe("Guest Name")
});

const ExpenseRecordSchema = z.object({
    m: z.string().describe("Merchant Name"),
    a: z.number().describe("Amount"),
    c: z.string().describe("Currency"),
    d: z.string().describe("Date YYYY-MM-DD"),
    cat: z.string().describe("Category")
});

const ExtractionOutputSchema = z.object({
    expenses: z.array(ExpenseRecordSchema),
    travel_logs: z.array(TravelLogSchema)
});

// --- AGENT: EXPENSE EXTRACTOR ---
async function runExpenseAgent(content: string, source: string) {
    const systemInstruction = `
    FINANCIAL AUDITOR & MOBILITY SPECIALIST.

    TASK:
    1. For SINGLE RECEIPTS/INVOICES/HOTEL FOLIOS: Extract exactly ONE consolidated expense record for the entire document.
       - FOR HOTEL BILLS: Extract the FINAL TOTAL CHARGE only. NEVER extract individual daily room rates, taxes, or service charges as separate rows.
       - UNIFIED AMOUNT: The 'amount' must be the total value of the invoice (e.g., 1590.00).
    2. For BANK/CREDIT CARD STATEMENTS: Identify as a statement and extract each transaction row.
    3. For TRAVEL DOCUMENTS: Populate 'travel_logs'.
    
    CRITICAL RULES:
    - NO MULTI-ROW EXTRACTION for receipts/invoices. One doc = One result.
    - If a document shows a "Total" and then lists taxes below it as a breakdown, DO NOT ADD THEM. Use the "Total" figure directly.
    - DO NOT use "Balance" if it is 0.00 (this means the bill is just paid). Use "Total Charges" or "Net Amount".
    - DATE INTERPRETATION: Interpret source dates as DD/MM/YYYY. (e.g., 01/12 is December 1st). 
    - DATE OUTPUT: ALWAYS return YYYY-MM-DD.
    - If the document mentions travel (flight, hotel, visa), 'travel_logs' MUST NOT BE EMPTY.
    
    TRAVEL LOG SPECIFICS:
    - provider: Airline or Hotel Name.
    - dest_city: Destination City.
    - dest_country: Destination Country.
    - HOTEL LOGS: type: 'accommodation', date: Check-in, end_date: Check-out.
  `;

    console.log(`[Agent] Starting extraction for source: ${source}`);

    const promptParts = [
        { text: `${systemInstruction}\n\nINPUT DATA:` },
        ...toParts(content)
    ];

    try {
        return await retryWithBackoff(async () => {
            const { output } = await ai.generate({
                model: gemini20Flash,
                prompt: promptParts,
                output: { format: 'json', schema: ExtractionOutputSchema },
                config: {
                    temperature: 0,
                }
            });
            return output;
        });
    } catch (e: any) {
        console.error("DEBUG: Genkit generate error after retries:", e);
        logError(e);
        throw e;
    }
}

// --- AGENT: BATCH EXTRACTOR ---
async function runBatchExpenseAgent(inputs: { content: string, source: string }[]) {
    const BatchSchema = z.object({
        results: z.array(ExtractionOutputSchema)
    });

    const systemInstruction = `
    HIGH-CAPACITY FINANCIAL AUDITOR.
    
    TASK: Process EXACTLY ${inputs.length} documents. 
    You MUST return an array 'results' with ABSOLUTELY EXACTLY ${inputs.length} items.
    
    CRITICAL INSTRUCTIONS:
    - For SINGLE RECEIPTS/INVOICES/HOTEL FOLIOS: Extract exactly ONE consolidated expense record per document.
      - NEVER extract individual daily charges or breakdown rows for hotel invoices.
      - Use the absolute FINAL TOTAL (Total Payable) as the 'amount'.
      - DO NOT manually sum line items; use the printed "Total" directly.
      - DO NOT use "Balance" if it is 0.00.
    - DO NOT SKIP ANY DOCUMENTS.
    - Extract ALL expenses from receipts and statements.
    - RETURN EVERY LINE ITEM FOR BANK STATEMENTS ONLY.

    RULES:
    - DATE INTERPRETATION: Interpret source dates as DD/MM/YYYY.
    - DATE OUTPUT: ALWAYS use YYYY-MM-DD.
    - Categories: Transport, Meals, Lodging, Office, Utilities, Salary, Transfer, General.
    
    TRAVEL LOG SPECIFICS:
    - HOTEL LOG RULES: type: 'accommodation', provider: Hotel Name, date: Check-in, end_date: Check-out.
    - FLIGHT LOG RULES: type: 'flight', provider: Airline, date: Departure, end_date: Return.
    - CONSOLIDATION: One document = ONE record. Merge all flight legs.
    - DATES: 'date' = departure, 'end_date' = return.
  `;

    // Build multimodal prompt parts
    const promptParts: any[] = [{ text: systemInstruction + "\n\nBATCH INPUTS:\n" }];

    inputs.forEach((inp, idx) => {
        promptParts.push({ text: `\n\n[[DOC ${idx} | Source: ${inp.source}]]\n` });
        promptParts.push(...toParts(inp.content));
    });

    try {
        return await retryWithBackoff(async () => {
            const { output } = await ai.generate({
                model: gemini20Flash,
                prompt: promptParts,
                output: { format: 'json', schema: BatchSchema },
                config: {
                    temperature: 0,
                }
            });
            console.log(`[Agent] RAW AI OUTPUT:`, JSON.stringify(output, null, 2));
            console.log(`[Agent] Batch Extraction Success. Results count: ${output.results?.length} (Expected: ${inputs.length})`);

            // Log sample of results for debugging
            output.results?.forEach((res: any, idx: number) => {
                console.log(`[Agent] Result ${idx}: Expenses found: ${res.expenses?.length}`);
            });

            return output;
        });
    } catch (e: any) {
        console.error("DEBUG: Batch Agent error:", e);
        logError(e);
        throw e;
    }
}

// --- AGENT: RECONCILIATION ---
async function runReconciliationAgent(expenses: any[]) {
    const ReconciliationSchema = z.object({
        matched: z.array(z.object({
            bankId: z.string(),
            receiptId: z.string(),
            proofLabel: z.string(),
            summary: z.string().describe("Brief forensic justification for the match")
        })),
        unmatchedReceipts: z.array(z.string()),
        unmatchedBankTransactions: z.array(z.string())
    });

    const systemInstruction = `
    ROLE: HIGH-PRECISION FORENSIC AUDITOR.
    GOAL: Match "ANCHOR" transactions (Bank/Credit Card) to "PROOF" documents (Receipts/Uploads).

    MATCHING ENTITIES:
    - You will receive a list of expenses where each item has a "role" field: "ANCHOR" or "PROOF".
    - You MUST ONLY match an "ANCHOR" to a "PROOF". 
    - NEVER match an "ANCHOR" to another "ANCHOR".
    - NEVER match a "PROOF" to another "PROOF".

    FORENSIC RULES:
    1. SOURCE INTEGRITY: Anchors are ground truth. Proofs are verification documents.
    2. AMOUNT & CURRENCY: Match even if amounts differ slightly (< 1%) or if currencies differ (e.g., 1 OMR ≈ 9.53 AED). 
    3. DATE: +/- 7 days post/pre window.
    4. MERCHANT: Fuzzy match (e.g. "FLYDUBAI" == "FLYDUBAI DXB").

    OUTPUT FORMAT: Return a "summary" for each match (e.g. "Fuzzy merchant match with 4-day gap").
    INPUT: JSON list of expenses with 'role'.
    OUTPUT: JSON list of matched IDs.
    `;

    try {
        return await retryWithBackoff(async () => {
            const { output } = await ai.generate({
                model: gemini20Flash,
                prompt: `${systemInstruction}\n\nAUDIT POOL:\n${JSON.stringify(expenses)}`,
                output: { format: 'json', schema: ReconciliationSchema },
                config: {
                    temperature: 0,
                }
            });
            return output;
        });
    } catch (e: any) {
        console.error("DEBUG: Reconciliation Agent error after retries:", e);
        logError(e);
        throw e;
    }
}

// --- ROUTES ---

app.post('/api/generate', async (req, res) => {
    try {
        const { content, source } = req.body;
        console.log(`[API] POST /api/generate - Source: ${source}`);
        const result = await runExpenseAgent(content, source);
        res.json(result);
    } catch (error: any) {
        console.error("Agent Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-batch', async (req, res) => {
    try {
        console.log(`[API] RECEIVING BATCH REQUEST...`);
        console.log(`[API] Body Keys: ${Object.keys(req.body)}`);

        const { inputs } = req.body;
        console.log(`[API] Input Count: ${inputs?.length}`);

        if (!inputs || inputs.length === 0) {
            console.error("[API] Error: Empty inputs received!");
            return res.status(400).json({ error: "Empty batch inputs" });
        }

        const result = await runBatchExpenseAgent(inputs);
        console.log(`[API] Returning ${result.results?.length} batch results.`);
        res.json(result);
    } catch (error: any) {
        console.error("Batch Agent Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reconcile', async (req, res) => {
    try {
        const { expenses } = req.body;
        console.log(`[API] POST /api/reconcile - Items: ${expenses?.length}`);
        const result = await runReconciliationAgent(expenses);
        res.json(result);
    } catch (error: any) {
        console.error("Reconciliation Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// SPA Routing: Serve index.html for any unknown routes
// Using app.use() instead of app.get('*') to avoid path-to-regexp issues
app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

const server = app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 GENKIT BATCH SERVER v2.0 - PORT: ${PORT}`);
    console.log(`================================================`);
});

// Explicit keep-alive and heartbeat
setInterval(() => {
    console.log(`[Heartbeat] Server is alive and listening...`);
}, 60000);
