import React, { useMemo, useState, useEffect } from 'react';
import { Expense } from '../types';
import {
  Receipt,
  CreditCard,
  Trash2,
  Clock,
  Database,
  Search,
  PieChart,
  Layers,
  Banknote,
  Send,
  Mail,
  AlertCircle,
  Filter,
  AlertTriangle,
  ShieldCheck,
  Plane,
  FileText,
  ChevronDown
} from 'lucide-react';
import { getExchangeRates, convertToINR, ExchangeRates } from '../currencyService';

interface DashboardProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  period: { month: string; year: number };
  onNavigateToClarify?: (expenseId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ expenses, onDelete, period, onNavigateToClarify }) => {
  const [exchangeData, setExchangeData] = useState<ExchangeRates | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [filterSource, setFilterSource] = useState("All Sources");
  const [filterBank, setFilterBank] = useState("All Banks");

  useEffect(() => {
    getExchangeRates().then(setExchangeData);
  }, []);

  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const isAnchor = (exp: Expense) => {
    const src = String(exp.source || '').toLowerCase().trim();
    return src === 'bank_statement' || src === 'credit_card_statement';
  };

  // REACTIVE FORENSIC AUDIT: Identifies "Verified" matches in real-time
  const verifiedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!exchangeData) return ids;

    const anchors = expenses.filter(isAnchor);
    const proofs = expenses.filter(e => !isAnchor(e));
    const rates = exchangeData.rates || {};

    anchors.forEach(bankTx => {
      const bINR = convertToINR(bankTx.amount, bankTx.currency, rates);
      const bDate = new Date(bankTx.date).getTime();

      const match = proofs.find(rec => {
        const rINR = convertToINR(rec.amount, rec.currency, rates);
        const rDate = new Date(rec.date).getTime();

        // Window Parity
        const diffDays = Math.abs(bDate - rDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 3) return false;

        // Merchant Parity
        const bMerc = bankTx.merchant.toLowerCase();
        const rMerc = rec.merchant.toLowerCase();
        const isTele = (m: string) => m.includes('e&') || m.includes('etisalat');
        const mercMatch = (isTele(bMerc) && isTele(rMerc)) || rMerc.includes(bMerc.substring(0, 4)) || bMerc.includes(rMerc.substring(0, 4));
        if (!mercMatch) return false;

        // Amount Parity
        const sameCurrency = bankTx.currency === rec.currency;
        const sameAmt = sameCurrency ? Math.abs(bankTx.amount - rec.amount) < 0.10 : Math.abs(bINR - rINR) < (bINR * 0.05);
        return sameAmt;
      });

      if (match) {
        ids.add(bankTx.id);
        ids.add(match.id);
      }
    });
    return ids;
  }, [expenses, exchangeData]);

  const duplicateMap = useMemo(() => {
    const map = new Map<string, string[]>();
    expenses.filter(e => e.source === 'telegram').forEach(e => {
      const key = `${e.merchant.toLowerCase()}-${e.amount}-${e.date}`;
      const existing = map.get(key) || [];
      map.set(key, [...existing, e.id]);
    });
    return map;
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter(e => {
      // 1. Period Match
      const parts = e.date.split('-');
      if (parts.length < 2) return false;
      const eYear = parseInt(parts[0]);
      const eMonth = parseInt(parts[1]) - 1;
      const matchesPeriod = eYear === period.year && (period.month === "All Months" || monthsList[eMonth] === period.month);
      if (!matchesPeriod) return false;

      // 2. Search Query (Merchant or Description)
      const matchesSearch = searchQuery === "" ||
        e.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Category Filter
      const matchesCategory = filterCategory === "All Categories" || e.category === filterCategory;
      if (!matchesCategory) return false;

      // 4. Status Filter (Checking if verified in real-time pool)
      const isVerified = verifiedIds.has(e.id);
      const matchesStatus = filterStatus === "All Status" ||
        (filterStatus === "Verified" ? isVerified : !isVerified);
      if (!matchesStatus) return false;

      // 5. Source Filter
      const matchesSource = filterSource === "All Sources" ||
        (filterSource === "Receipt" && e.source === "receipt") ||
        (filterSource === "Web Document" && e.source === "web_upload") ||
        (filterSource === "Bank Statement" && e.source === "bank_statement") ||
        (filterSource === "Credit Card Statement" && e.source === "credit_card_statement") ||
        (filterSource === "Telegram Bot" && e.source === "telegram") ||
        (filterSource === "Email Alert" && e.source === "email");
      if (!matchesSource) return false;

      // 6. Bank Filter
      const matchesBank = filterBank === "All Banks" || e.bank === filterBank;
      if (!matchesBank) return false;

      // 7. Legacy Type Filter (if still needed)
      const matchesType = selectedTypeFilter === "All Types" || e.expense_type === selectedTypeFilter;
      if (!matchesType) return false;

      return true;
    });

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, period, selectedTypeFilter, searchQuery, filterCategory, filterStatus, filterSource]);

  const stats = useMemo(() => {
    const rates = exchangeData?.rates || {};
    const totalINR = filteredExpenses.reduce((acc, curr) => acc + convertToINR(curr.amount, curr.currency, rates), 0);
    const count = filteredExpenses.length;
    const sources = filteredExpenses.reduce((acc: any, curr) => {
      acc[curr.source] = (acc[curr.source] || 0) + 1;
      return acc;
    }, {});
    return { totalINR, count, sources };
  }, [filteredExpenses, exchangeData]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateLabel = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const SourceIcon = ({ source }: { source: string }) => {
    switch (source) {
      case 'receipt': return <FileText size={18} className="text-emerald-500" />;
      case 'web_upload': return <ShieldCheck size={18} className="text-brand-500" />;
      case 'credit_card_statement': return <CreditCard size={18} className="text-indigo-500" />;
      case 'bank_statement': return <Database size={18} className="text-amber-500" />;
      case 'telegram': return <Send size={18} className="text-sky-500" />;
      case 'email': return <Mail size={18} className="text-pink-500" />;
      default: return <Search size={18} />;
    }
  };

  const getReimbursementText = (status?: string) => {
    if (status === 'Pending') return 'Reimbursable (Paid by Employee)';
    if (status === 'Not Needed') return 'Company Paid';
    return null;
  };

  // Placeholder screen if NO data at all in the system for this period
  const totalEntriesInPeriod = useMemo(() => {
    return expenses.filter(e => {
      const parts = e.date.split('-');
      if (parts.length < 2) return false;
      const eYear = parseInt(parts[0]);
      const eMonth = parseInt(parts[1]) - 1;
      return eYear === period.year && (period.month === "All Months" || monthsList[eMonth] === period.month);
    }).length;
  }, [expenses, period]);

  if (totalEntriesInPeriod === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-48 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-slate-300 dark:text-slate-700 mb-8">
          <Layers size={48} strokeWidth={1} />
        </div>
        <h3 className="text-2xl font-black tracking-tighter uppercase">No Financial Records</h3>
        <p className="text-slate-500 mt-2 max-w-sm font-medium text-sm">Our audit logs are currently empty for this specific period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stat Cards - Matching Image Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-brand-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-48">
          <div className="absolute top-0 right-0 p-8 opacity-20"><Banknote size={80} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Portfolio Burn</p>
            <h4 className="text-4xl font-black tracking-tighter mt-1">₹{stats.totalINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
          </div>
          <div className="bg-white/20 w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
            {stats.count} Transacts
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-48">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500"><Receipt size={24} /></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Document Scan</p>
              <h4 className="text-3xl font-black tracking-tighter">{(stats.sources.receipt || 0) + (stats.sources.web_upload || 0)}</h4>
            </div>
          </div>
          <div className="mt-auto w-full h-1 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((stats.sources.receipt || 0) + (stats.sources.web_upload || 0)) / (stats.count || 1) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-48">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-500"><Send size={24} /></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobile Bot</p>
              <h4 className="text-3xl font-black tracking-tighter">{stats.sources.telegram || 0}</h4>
            </div>
          </div>
          <div className="mt-auto w-full h-1 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (stats.sources.telegram || 0) / (stats.count || 1) * 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-48">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500"><CreditCard size={24} /></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Financial Vault</p>
              <h4 className="text-3xl font-black tracking-tighter">{(stats.sources.credit_card_statement || 0) + (stats.sources.bank_statement || 0) + (stats.sources.email || 0)}</h4>
            </div>
          </div>
          <div className="mt-auto w-full h-1 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, ((stats.sources.credit_card_statement || 0) + (stats.sources.bank_statement || 0) + (stats.sources.email || 0)) / (stats.count || 1) * 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Ledger Section */}
      <div className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="px-12 py-10 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600"><PieChart size={24} /></div>
            <div>
              <h3 className="text-xl font-black tracking-tighter uppercase">Transaction Ledger</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Immutable Financial Records</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Clock size={14} className="text-brand-500" /> {period.month} {period.year}
            </div>
          </div>
        </div>

        {/* REACTIVE FILTER BAR - Glassmorphism UI */}
        <div className="px-12 py-8 flex flex-wrap items-center gap-4 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-xl border-b border-slate-50 dark:border-slate-800/60">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search merchants or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-16 pr-6 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="flex items-center gap-3">
            {[
              {
                label: 'ALL CATEGORIES',
                value: filterCategory,
                setter: setFilterCategory,
                options: ['All Categories', ...Array.from(new Set(expenses.map(e => e.category)))]
              },
              {
                label: 'ALL STATUS',
                value: filterStatus,
                setter: setFilterStatus,
                options: ['All Status', 'Verified', 'Needs Review']
              },
              {
                label: 'ALL SOURCES',
                value: filterSource,
                setter: setFilterSource,
                options: ['All Sources', 'Receipt', 'Web Document', 'Bank Statement', 'Credit Card Statement', 'Telegram Bot', 'Email Alert']
              },
              {
                label: 'ALL BANKS',
                value: filterBank,
                setter: setFilterBank,
                options: ['All Banks', 'Amex', 'Citi', 'HSBC', 'Standard Chartered', 'Other']
              }
            ].map((filter, i) => (
              <div key={i} className="relative group">
                <select
                  value={filter.value}
                  onChange={(e) => filter.setter(e.target.value)}
                  className="appearance-none bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl py-4 px-6 pr-12 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                >
                  {filter.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th className="px-12 py-6">Identity</th>
                <th className="px-12 py-6">Timeline</th>
                <th className="px-12 py-6">Classification</th>
                <th className="px-12 py-6">Value</th>
                <th className="px-12 py-6">Provenance</th>
                <th className="px-12 py-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                      <Search size={48} strokeWidth={1} className="mb-4 opacity-50" />
                      <p className="text-sm font-bold uppercase tracking-widest">No results matching your filters</p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterCategory("All Categories");
                          setFilterStatus("All Status");
                          setFilterSource("All Sources");
                        }}
                        className="mt-6 text-[10px] font-black underline underline-offset-4 text-brand-500 hover:text-brand-600 uppercase tracking-widest"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.map((e) => {
                const dupeIds = duplicateMap.get(`${e.merchant.toLowerCase()}-${e.amount}-${e.date}`) || [];
                const isDuplicate = e.source === 'telegram' && dupeIds.length > 1;
                const isVerified = verifiedIds.has(e.id);

                return (
                  <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group transition-all">
                    <td className="px-12 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {e.merchant}
                            {e.bank && <span className="ml-2 text-[9px] text-brand-500 font-bold">({e.bank})</span>}
                          </span>
                          {isVerified && (
                            <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20">
                              <ShieldCheck size={8} className="inline mr-1" /> Verified
                            </span>
                          )}
                          {isDuplicate && (
                            <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
                              ⚠️ DUPLICATE
                            </span>
                          )}
                        </div>

                        {/* Telegram Bot Specific Data View */}
                        {e.source === 'telegram' ? (
                          <div className="text-[11px] text-slate-400 font-medium italic space-y-0.5">
                            <div>Category: {e.main_category || 'Personal'}</div>
                            {e.main_category === 'Business' && (
                              <>
                                <div>Company/Project: {e.company_project || 'Not Specified'}</div>
                                {getReimbursementText(e.reimbursement_status) && (
                                  <div>Reimbursement: {getReimbursementText(e.reimbursement_status)}</div>
                                )}
                              </>
                            )}
                            <div>Notes: {e.notes || 'None provided'}</div>
                            {e.travel_log_id && (
                              <div className="flex items-center gap-2 text-brand-500 font-black not-italic text-[10px] mt-2">
                                <Plane size={12} /> Related Travel Document Attached
                              </div>
                            )}
                            <div className="not-italic text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wider">
                              Uploaded: {formatDateLabel(e.created_at)} at {formatTime(e.created_at)}
                            </div>
                          </div>
                        ) : (
                          /* Web, Bank, Email Data View - Cleaner, hides bot-specific fields */
                          <div className="text-[11px] text-slate-400 font-medium italic space-y-0.5">
                            {e.source === 'web_upload' ? (
                              <div>Classification: {e.category}</div>
                            ) : (
                              <div>{e.description || "No supplemental details provided"}</div>
                            )}

                            {e.travel_log_id && (
                              <div className="flex items-center gap-2 text-brand-500 font-black not-italic text-[10px] mt-2">
                                <Plane size={12} /> Related Travel Document Attached
                              </div>
                            )}

                            <div className="not-italic text-[10px] mt-1 text-slate-400 font-bold uppercase tracking-wider">
                              Uploaded: {formatDateLabel(e.created_at)} at {formatTime(e.created_at)}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-12 py-6">
                      <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        <div className="flex items-center gap-2"><Clock size={14} className="opacity-30" /> {e.date}</div>
                        <div className="ml-5 opacity-60">{e.time || formatTime(e.created_at)}</div>
                      </div>
                    </td>
                    <td className="px-12 py-6">
                      <span className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-12 py-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.currency}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-0.5">Gross Value</span>
                      </div>
                    </td>
                    <td className="px-12 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${e.source === 'telegram' ? 'bg-sky-50 dark:bg-sky-500/10' :
                          e.source === 'email' ? 'bg-pink-50 dark:bg-pink-500/10' :
                            e.source === 'web_upload' ? 'bg-brand-50 dark:bg-brand-500/10' :
                              'bg-slate-50 dark:bg-slate-800'
                          }`}>
                          <SourceIcon source={e.source} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${e.source === 'telegram' ? 'text-sky-600' :
                          e.source === 'email' ? 'text-pink-600' :
                            e.source === 'web_upload' ? 'text-brand-600' :
                              'text-slate-400'
                          }`}>
                          {e.source === 'telegram' ? 'Telegram Bot' : e.source === 'email' ? 'Email Alert' : e.source === 'web_upload' ? 'Web Document' : e.source.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-12 py-6 text-right">
                      <button onClick={() => onDelete(e.id)} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-95">
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;