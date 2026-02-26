
import React, { useState, useMemo, useEffect } from 'react';
import { Expense, ReconciliationResult, ReconciliationReport } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Loader2,
  Zap,
  Database,
  Target,
  FileQuestion,
  Info,
  RefreshCcw,
  Globe,
  FileSearch,
  AlertCircle,
  CalendarDays,
  CreditCard,
  Mail,
  Receipt,
  FileText,
  Plus,
  ChevronRight
} from 'lucide-react';
import { getExchangeRates, convertToINR, ExchangeRates } from '../currencyService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReconcilerProps {
  expenses: Expense[];
  reconciliation: ReconciliationResult | null;
  isProcessing: boolean;
  onSaveReport: (report: ReconciliationReport) => Promise<void>;
  isSaving?: boolean;
  saveSuccess?: boolean;
  period: { month: string; year: number };
  auditBank?: string;
  onBankChange?: (bank: string) => void;
}

const Reconciler: React.FC<ReconcilerProps> = ({
  expenses,
  reconciliation,
  isProcessing,
  period,
  onSaveReport,
  isSaving,
  saveSuccess,
  auditBank = "All Accounts",
  onBankChange
}) => {
  const [exchangeData, setExchangeData] = useState<ExchangeRates | null>(null);

  const downloadAsPDF = () => {
    const doc = new jsPDF();
    const title = `Expense Audit Report: ${period.month} ${period.year}`;
    const bankFilter = auditBank === "All Accounts" ? "Overall Portfolio" : `${auditBank} Account`;

    doc.setFontSize(22);
    doc.text("ExpenseFlow Intelligence", 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${title} | ${bankFilter}`, 14, 30);
    doc.text(`Compliance Accuracy: ${filteredData.stats.score}%`, 14, 38);

    const tableData = filteredData.matched.map(p => [
      p.bank?.date || '',
      p.bank?.merchant || '',
      p.bank?.category || '',
      `${p.bank?.currency} ${p.bank?.amount.toLocaleString()}`,
      p.label || 'Verified'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Merchant', 'Category', 'Amount', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 39, 255] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    if (filteredData.mandatoryMissing.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38);
      doc.text("MANDATORY PROOF REQUIRED", 14, currentY);

      const mandatoryData = filteredData.mandatoryMissing.map(e => [
        e.date, e.merchant, e.category, `${e.currency} ${e.amount.toLocaleString()}`, 'MISSING RECEIPT'
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Merchant', 'Category', 'Amount', 'Alert']],
        body: mandatoryData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (filteredData.standardMissing.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(217, 119, 6);
      doc.text("GENERAL EVIDENCE MISSING", 14, currentY);

      const generalData = filteredData.standardMissing.map(e => [
        e.date, e.merchant, e.category, `${e.currency} ${e.amount.toLocaleString()}`, 'UNMATCHED'
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Merchant', 'Category', 'Amount', 'Status']],
        body: generalData,
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6] }
      });
    }

    doc.save(`Audit_${period.month}_${period.year}_${auditBank.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadAsExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 1. Verified Ledger
    const verifiedData = filteredData.matched.map(p => ({
      Date: p.bank?.date,
      Merchant: p.bank?.merchant,
      Category: p.bank?.category,
      Amount: p.bank?.amount,
      Currency: p.bank?.currency,
      Status: p.label,
      Bank: p.bank?.bank || auditBank
    }));
    const verifiedSheet = XLSX.utils.json_to_sheet(verifiedData);
    XLSX.utils.book_append_sheet(workbook, verifiedSheet, "Verified Ledger");

    // 2. Mandatory Proof Required
    const mandatoryData = filteredData.mandatoryMissing.map(e => ({
      Date: e.date,
      Merchant: e.merchant,
      Category: e.category,
      Amount: e.amount,
      Currency: e.currency,
      Status: "MISSING",
      Bank: e.bank || auditBank
    }));
    const mandatorySheet = XLSX.utils.json_to_sheet(mandatoryData);
    XLSX.utils.book_append_sheet(workbook, mandatorySheet, "Mandatory Proof");

    // 3. General Evidence
    const generalData = filteredData.standardMissing.map(e => ({
      Date: e.date,
      Merchant: e.merchant,
      Category: e.category,
      Amount: e.amount,
      Currency: e.currency,
      Status: "UNMATCHED",
      Bank: e.bank || auditBank
    }));
    const generalSheet = XLSX.utils.json_to_sheet(generalData);
    XLSX.utils.book_append_sheet(workbook, generalSheet, "General Evidence");

    XLSX.writeFile(workbook, `Audit_${period.month}_${period.year}_${auditBank.replace(/\s+/g, '_')}.xlsx`);
  };

  useEffect(() => {
    getExchangeRates().then(setExchangeData);
  }, []);

  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const filteredData = useMemo(() => {
    const rates = exchangeData?.rates || {};

    /**
     * ROBUST DATE MATCHER - Segment Based (YYYY-MM-DD)
     */
    const isTargetPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length < 2) return false;

      const y = parseInt(parts[0]);
      const mIdx = parseInt(parts[1]) - 1;

      const yearMatch = y === period.year;
      const monthMatch = period.month === "All Months" || monthsList[mIdx] === period.month;

      return yearMatch && monthMatch;
    };

    /**
     * AUDIT ANCHOR ENGINE
     */
    const isAnchor = (e: Expense) => {
      const src = String(e.source || '').toLowerCase().trim();
      return src === 'bank_statement' || src === 'credit_card_statement';
    };

    const allAnchorsInPeriod = expenses.filter(e =>
      isAnchor(e) &&
      isTargetPeriod(e.date) &&
      (auditBank === "All Accounts" || e.bank === auditBank)
    );
    const totalVaultAnchors = expenses.filter(e =>
      isAnchor(e) &&
      (auditBank === "All Accounts" || e.bank === auditBank)
    );

    // Prepare Expense Map for ID Lookups
    const expenseMap = new Map<string, Expense>();
    expenses.forEach(e => { if (e.id) expenseMap.set(String(e.id), e); });

    // 1. Initial Matcher (AI Results)
    let matchedPairs = (reconciliation?.matched || []).map(m => {
      const bank = m.bankId ? expenseMap.get(String(m.bankId)) : null;
      const receipt = (m.receiptId || m.emailId) ? expenseMap.get(String(m.receiptId || m.emailId || '')) : null;

      /**
       * FORENSIC AIR-GAP GUARD
       * 1. Unique IDs: Never match an item to itself.
       * 2. Source Integrity: Bank records can only match non-bank records.
       */
      if (!bank || !receipt || bank.id === receipt.id || isAnchor(receipt)) return null;

      /**
       * FORENSIC VALIDATION LAYER (Hard Guardrail)
       * Use INR as Common Denominator for cross-currency parity.
       */
      const bDate = new Date(bank.date).getTime();
      const rDate = new Date(receipt.date).getTime();
      const diffDays = Math.abs(bDate - rDate) / (1000 * 60 * 60 * 24);

      const bINR = convertToINR(bank.amount, bank.currency, rates);
      const rINR = convertToINR(receipt.amount, receipt.currency, rates);

      // FOR CROSS-CURRENCY: Allow 5% margin if AI suggested it
      const sameCurrency = bank.currency === receipt.currency;
      const sameAmt = sameCurrency ? Math.abs(bank.amount - receipt.amount) < 0.10 : Math.abs(bINR - rINR) < (bINR * 0.05);

      // MERCHANT SYNONYM CHECK
      const bMerc = bank.merchant.toLowerCase();
      const rMerc = receipt.merchant.toLowerCase();
      const isTele = (m: string) => m.includes('e&') || m.includes('etisalat');
      const isRTA = (m: string) => m.includes('rta') || m.includes('road & transport') || m.includes('dubai metro') || m.includes('hala taxi');
      const mercMatch = (isTele(bMerc) && isTele(rMerc)) ||
        (isRTA(bMerc) && isRTA(rMerc)) ||
        rMerc.includes(bMerc.substring(0, 4)) ||
        bMerc.includes(rMerc.substring(0, 4));

      const isHotel = bank.category.toLowerCase().includes('lodging') || bank.category.toLowerCase().includes('hotel') || receipt.category.toLowerCase().includes('lodging') || receipt.category.toLowerCase().includes('hotel');
      const maxDays = isHotel ? 14 : 7;

      if (diffDays > maxDays || !sameAmt || !mercMatch) return null;

      return { bank, receipt, label: m.proofLabel, summary: m.summary };
    }).filter((pair): pair is { bank: Expense, receipt: Expense, label: string, summary: string } =>
      pair !== null &&
      isTargetPeriod(pair.bank.date) &&
      (auditBank === "All Accounts" || pair.bank.bank === auditBank)
    );

    // 2. Heuristic Fallback Matcher (±3 Day Clearance Window)
    const matchedBankIds = new Set(matchedPairs.map(p => p.bank?.id).filter(Boolean));
    const unmatchedAnchors = allAnchorsInPeriod.filter(b => !matchedBankIds.has(b.id));
    const availableReceipts = expenses.filter(e => !isAnchor(e) && !matchedPairs.some(p => p.receipt?.id === e.id));

    unmatchedAnchors.forEach(bankTx => {
      // Find a forensic match: same amount + 3-day window + fuzzy merchant
      const autoMatch = availableReceipts.find(rec => {
        const bINR = convertToINR(bankTx.amount, bankTx.currency, rates);
        const rINR = convertToINR(rec.amount, rec.currency, rates);

        // Date Clearance Window Logic
        const bDate = new Date(bankTx.date).getTime();
        const rDate = new Date(rec.date).getTime();
        const diffDays = Math.abs(bDate - rDate) / (1000 * 60 * 60 * 24);

        const isHotel = (bankTx.category || '').toLowerCase().includes('hotel') || (bankTx.category || '').toLowerCase().includes('lodging') ||
          (rec.category || '').toLowerCase().includes('hotel') || (rec.category || '').toLowerCase().includes('lodging');
        const maxDays = isHotel ? 14 : 3;
        const withinWindow = diffDays <= maxDays;

        // MERCHANT SYNONYM MATCHING
        const bMerc = bankTx.merchant.toLowerCase();
        const rMerc = rec.merchant.toLowerCase();
        const isTele = (m: string) => m.includes('e&') || m.includes('etisalat');
        const isRTA = (m: string) => m.includes('rta') || m.includes('road & transport') || m.includes('dubai metro') || m.includes('hala taxi');
        const mercMatch = (isTele(bMerc) && isTele(rMerc)) ||
          (isRTA(bMerc) && isRTA(rMerc)) ||
          rMerc.includes(bMerc.substring(0, 4)) ||
          bMerc.includes(rMerc.substring(0, 4));

        // CURRENCY-AWARE PARITY
        const sameCurrency = bankTx.currency === rec.currency;
        const sameAmtVal = sameCurrency ? Math.abs(bankTx.amount - rec.amount) < 0.10 : Math.abs(bINR - rINR) < (bINR * 0.05);

        // SOURCE INTEGRITY: Heuristic receipt must NOT be from a bank source
        const validSource = !isAnchor(rec);

        return sameAmtVal && withinWindow && mercMatch && validSource;
      });

      if (autoMatch) {
        matchedPairs.push({
          bank: bankTx,
          receipt: autoMatch,
          label: 'AUTO-VERIFIED (Forensic Match)',
          summary: 'Verified via ±3 day clearance window heuristic match.'
        });
        matchedBankIds.add(bankTx.id);
        const idx = availableReceipts.indexOf(autoMatch);
        if (idx > -1) availableReceipts.splice(idx, 1);
      }
    });

    const finalUnmatchedBankTx = allAnchorsInPeriod.filter(b => !matchedBankIds.has(b.id));

    const mandatoryMissing: Expense[] = [];
    const standardMissing: Expense[] = [];
    const optionalMissing: Expense[] = [];

    finalUnmatchedBankTx.forEach(exp => {
      const amountINR = convertToINR(exp.amount, exp.currency, rates);
      const merc = (exp.merchant || '').toLowerCase();
      const cat = (exp.category || '').toLowerCase();

      // 1. MANDATORY LOGIC
      const isMandatory = ['travel', 'hotel', 'flight', 'airline', 'stay', 'flydubai', 'ibis', 'accommodation']
        .some(k => merc.includes(k) || cat.includes(k));

      // 2. OPTIONAL LOGIC (Threshold: 10 AED / ~225 INR)
      const isOptional = ['bank charges', 'transfer', 'vat', 'tax', 'finance', 'charge']
        .some(k => merc.includes(k) || cat.includes(k)) || amountINR < 225;

      if (isMandatory) mandatoryMissing.push(exp);
      else if (isOptional) optionalMissing.push(exp);
      else standardMissing.push(exp);
    });

    const scoreDenominator = matchedPairs.length + mandatoryMissing.length + standardMissing.length;
    const score = scoreDenominator > 0 ? Math.round((matchedPairs.length / scoreDenominator) * 100) : 100;

    return {
      matched: matchedPairs,
      mandatoryMissing, standardMissing, optionalMissing,
      stats: { matchedCount: matchedPairs.length, score, totalBankTx: allAnchorsInPeriod.length, totalVault: totalVaultAnchors.length },
      fullReport: {
        month: period.month,
        year: period.year,
        matched_transactions: matchedPairs.map(p => p.bank!).filter(Boolean),
        mandatory_missing: mandatoryMissing,
        optional_missing: optionalMissing,
        standard_missing: standardMissing,
        summary: {
          total_matched: matchedPairs.length,
          total_unmatched: finalUnmatchedBankTx.length,
          compliance_score: score,
          mandatory_error_count: mandatoryMissing.length,
          warning_count: standardMissing.length,
          optional_count: optionalMissing.length
        }
      } as ReconciliationReport
    };
  }, [reconciliation, expenses, exchangeData, period, auditBank]);

  if (isProcessing) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-8">
        <Loader2 className="text-brand-600 animate-spin" size={80} />
        <ShieldCheck className="absolute inset-0 m-auto text-brand-600" size={32} />
      </div>
      <h3 className="text-3xl font-black uppercase tracking-tight">Syncing Forensic Data</h3>
      <p className="text-slate-500 mt-2 font-medium">Cross-referencing {period.month} {period.year} audit ledger...</p>
    </div>
  );

  if (filteredData.stats.totalBankTx === 0) return (
    <div className="max-w-4xl mx-auto py-20 px-8">
      <div className="bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-200 dark:border-slate-800 shadow-sm p-16 text-center">
        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-8 text-amber-600">
          <AlertCircle size={48} />
        </div>
        <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Audit Anchor Mismatch</h3>
        <p className="text-slate-500 mt-4 mb-10 text-base font-medium max-w-lg mx-auto leading-relaxed">
          The Auditor is scanning for <b>{period.month} {period.year}</b> bank records.
          Upload a bank statement or credit card extract for this period to proceed.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 dark:border-slate-800 pt-10">
          <div className="flex items-center gap-2 text-brand-600"><Database size={14} /> Synchronized Engine v4</div>
          <div className="flex items-center gap-2"><CreditCard size={14} /> Source Parity Check</div>
        </div>
      </div>
    </div>
  );

  const complianceScore = filteredData.stats.score;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#0b1120] rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Compliance Integrity: {period.month} {period.year}</div>
          <div className="flex items-baseline gap-4">
            <h3 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase whitespace-nowrap">
              {complianceScore}% Accuracy
            </h3>

            <div className="relative group">
              <select
                value={auditBank}
                onChange={(e) => onBankChange?.(e.target.value)}
                className="appearance-none bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-6 pr-12 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              >
                <option value="All Accounts">All Accounts</option>
                {Array.from(new Set(expenses.filter(e => e.source.includes('bank') || e.source.includes('card')).map(e => e.bank))).filter(Boolean).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <ChevronRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
            </div>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredData.stats.matchedCount} Verified out of {filteredData.stats.totalBankTx} ledger entries</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => onSaveReport(filteredData.fullReport)}
            disabled={isSaving || saveSuccess}
            className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Archiving...' : saveSuccess ? 'Snapshot Filed' : 'File Period Audit'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={downloadAsPDF}
              className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <FileText size={14} /> PDF
            </button>
            <button
              onClick={downloadAsExcel}
              className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              <Plus size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <div className="text-emerald-500 font-black text-5xl tracking-tighter mb-1">{filteredData.stats.matchedCount}</div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verified</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <div className="text-blue-500 font-black text-5xl tracking-tighter mb-1">{filteredData.optionalMissing.length}</div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Optional</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <div className="text-amber-500 font-black text-5xl tracking-tighter mb-1">{filteredData.standardMissing.length}</div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">General</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <div className="text-red-500 font-black text-5xl tracking-tighter mb-1">{filteredData.mandatoryMissing.length}</div>
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Hard Gaps</div>
        </div>
      </div>

      <section className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
        <div className="px-10 py-6 bg-emerald-600 text-white flex items-center gap-4">
          <CheckCircle2 size={24} />
          <h4 className="text-[12px] font-black uppercase tracking-[0.2em]">Verified Ledger (Snapshot)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredData.matched.length === 0 ? (
                <tr><td className="p-12 text-center text-slate-400 font-medium italic">Scanning for proof matches in audit pool...</td></tr>
              ) : filteredData.matched.map((pair, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-12 py-8">
                    <div className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-[13px]">
                      {pair.bank?.merchant}
                      {pair.bank?.bank && <span className="ml-2 text-[9px] text-brand-500 font-bold">({pair.bank.bank})</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{pair.bank?.date} • {pair.bank?.category}</div>
                  </td>
                  <td className="px-12 py-8 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20">
                      PROOF VERIFIED
                    </span>
                  </td>
                  <td className="px-12 py-8 text-right font-black text-slate-900 dark:text-white uppercase text-sm">
                    {pair.bank?.currency} {pair.bank?.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {
        filteredData.mandatoryMissing.length > 0 && (
          <section className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-red-200 dark:border-red-900 overflow-hidden shadow-sm">
            <div className="px-10 py-6 bg-red-600 text-white flex items-center gap-4">
              <AlertTriangle size={24} />
              <h4 className="text-[12px] font-black uppercase tracking-[0.2em]">Mandatory Proof Required</h4>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredData.mandatoryMissing.map(exp => (
                <div key={exp.id} className="px-10 py-8 flex items-center justify-between hover:bg-red-50/20 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600"><Target size={20} /></div>
                    <div>
                      <div className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{exp.merchant}</div>
                      <div className="text-[10px] text-red-600 font-bold uppercase mt-1">{exp.category} • {exp.date}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm font-black text-red-700 dark:text-red-400 uppercase">{exp.currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      {
        filteredData.standardMissing.length > 0 && (
          <section className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-amber-200 dark:border-amber-900 overflow-hidden shadow-sm">
            <div className="px-10 py-6 bg-amber-500 text-white flex items-center gap-4">
              <Search size={24} />
              <h4 className="text-[12px] font-black uppercase tracking-[0.2em]">General Evidence Missing</h4>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredData.standardMissing.map(exp => (
                <div key={exp.id} className="px-10 py-8 flex items-center justify-between hover:bg-amber-50/20 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-500"><FileQuestion size={20} /></div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                        {exp.merchant}
                        {exp.bank && <span className="ml-2 text-[9px] text-brand-500 font-bold">({exp.bank})</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {exp.date} • {exp.category}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm font-black text-slate-900 dark:text-white uppercase">{exp.currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </section>
        )
      }
    </div >
  );
};

export default Reconciler;
