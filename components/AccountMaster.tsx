import React, { useState, useMemo, useEffect } from 'react';
import {
    Expense,
    TravelLog,
    AppSettings,
    ReconciliationReport
} from '../types';
import {
    updateExpense,
    verifyExpense,
    subscribeToReports,
    subscribeToAuthorizedUsers
} from '../firebaseService';
import {
    Plane,
    User,
    Calendar,
    Tag,
    Edit3,
    CheckCircle,
    Search,
    ChevronDown,
    Filter,
    ArrowUpDown,
    AlertTriangle,
    Check,
    Layers,
    History,
    FileText,
    FileQuestion,
    ShieldCheck,
    Send,
    Mail,
    Database,
    CreditCard,
    MessageCircle
} from 'lucide-react';
import TravelTracker from './TravelTracker';

interface AccountMasterProps {
    expenses: Expense[];
    allExpenses?: Expense[];
    travelLogs: TravelLog[];
    targetAuditee: string;
    onAuditeeChange: (newUser: string) => void;
    period: { month: string; year: number };
    onMonthChange: (month: string) => void;
    onYearChange: (year: number) => void;
    settings: AppSettings;
    customCategories?: string[];
    session: any;
}

const STANDARD_CATEGORIES = ['Transport', 'Meals', 'Lodging', 'Office', 'Utilities', 'Salary', 'Transfer', 'General'];

const AccountMaster: React.FC<AccountMasterProps> = ({
    expenses,
    travelLogs,
    targetAuditee,
    onAuditeeChange,
    period,
    onMonthChange,
    onYearChange,
    settings,
    customCategories = [],
    allExpenses = [],
    session
}) => {
    const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null);
    const [editingClassificationId, setEditingClassificationId] = useState<string | null>(null);
    const [tempIdentity, setTempIdentity] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const [view, setView] = useState<'ledger' | 'reports' | 'travel'>('ledger');
    const [reports, setReports] = useState<ReconciliationReport[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

    const [allAuthorizedUsers, setAllAuthorizedUsers] = useState<string[]>([]);

    const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    useEffect(() => {
        const unsubscribe = subscribeToAuthorizedUsers(setAllAuthorizedUsers);
        return () => unsubscribe();
    }, []);

    const allUsers = useMemo(() => {
        return allAuthorizedUsers.filter(email => email !== session?.email).sort();
    }, [allAuthorizedUsers, session]);

    useEffect(() => {
        setIsLoadingReports(true);
        const unsubscribe = subscribeToReports((data) => {
            setReports(data);
            setIsLoadingReports(false);
        }, period.year, targetAuditee === 'All Employees' ? undefined : (targetAuditee === 'Self' ? session?.email : targetAuditee));

        return () => unsubscribe();
    }, [period.year, targetAuditee, session]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (!e.date) return true;
            const parts = e.date.split('-');
            if (parts.length < 2) return true;
            const eYear = parseInt(parts[0]);
            const eMonthIndex = parseInt(parts[1]) - 1;

            const yearMatch = eYear === period.year;
            const monthMatch = period.month === "All Months" || monthsList[eMonthIndex] === period.month;

            return yearMatch && monthMatch;
        });
    }, [expenses, period, monthsList]);

    const allCategories = useMemo(() => {
        return Array.from(new Set([...STANDARD_CATEGORIES, ...settings.custom_expense_heads]));
    }, [settings.custom_expense_heads]);

    const handleUpdateIdentity = async (id: string) => {
        if (!tempIdentity.trim()) return;
        try {
            await updateExpense(id, { merchant: tempIdentity });
            setEditingIdentityId(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateClassification = async (id: string, cat: string) => {
        if (cat === 'Other') return; // Handled by custom input
        try {
            await updateExpense(id, { category: cat });
            setEditingClassificationId(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddCustomCategory = async (id: string) => {
        if (!customCategory.trim()) return;
        try {
            await updateExpense(id, { category: customCategory });
            setEditingClassificationId(null);
            setCustomCategory("");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Controls */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                        <User size={24} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditing Context</p>
                        <h3 className="text-xl font-black tracking-tighter dark:text-white uppercase">Account Master</h3>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={16} />
                        <select
                            className="pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[11px] font-black appearance-none focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all cursor-pointer uppercase tracking-widest"
                            value={targetAuditee}
                            onChange={(e) => onAuditeeChange(e.target.value)}
                        >
                            <option value="Self">My View</option>
                            <option value="All Employees">All Employees</option>
                            {allUsers.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <select
                            className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none cursor-pointer"
                            value={period.month}
                            onChange={(e) => onMonthChange(e.target.value)}
                        >
                            {["All Months", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                            className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700"
                            value={period.year}
                            onChange={(e) => onYearChange(parseInt(e.target.value))}
                        >
                            {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl w-fit">
                    <button
                        onClick={() => setView('ledger')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'ledger' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers size={14} /> Global Ledger
                    </button>
                    <button
                        onClick={() => setView('travel')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'travel' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plane size={14} /> Travel Tracker
                    </button>
                    <button
                        onClick={() => setView('reports')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'reports' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} /> Employee Reports
                    </button>
                </div>
            </div>

            {view === 'ledger' && (
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classification</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Provenance</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Trail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                    {((expense as any).owner_email || expense.user_id || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-black truncate max-w-[150px] dark:text-white uppercase tracking-tight">
                                                        {((expense as any).owner_email === 'SHARED_POOL' || expense.user_id === 'SHARED_POOL') ?
                                                            'SYSTEM (SHARED)' : ((expense as any).owner_email || expense.user_id || 'System')}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {editingIdentityId === expense.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        autoFocus
                                                        className="bg-slate-50 dark:bg-slate-800 border-2 border-brand-500 rounded-xl px-3 py-1.5 text-xs font-bold w-48 focus:outline-none"
                                                        value={tempIdentity}
                                                        onChange={(e) => setTempIdentity(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateIdentity(expense.id)}
                                                    />
                                                    <button onClick={() => handleUpdateIdentity(expense.id)} className="p-2 bg-brand-600 text-white rounded-xl shadow-lg shadow-brand-500/20"><Check size={14} /></button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer hover:text-brand-600 transition-colors"
                                                    onClick={() => { setEditingIdentityId(expense.id); setTempIdentity(expense.merchant); }}
                                                >
                                                    <span className="text-sm font-black dark:text-white uppercase tracking-tight">{expense.merchant}</span>
                                                    <Edit3 size={12} className="opacity-0 group-hover:opacity-40" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Calendar size={12} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">{expense.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {editingClassificationId === expense.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <select
                                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                                        value={customCategory ? 'Other' : expense.category}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'Other') setCustomCategory("New Category");
                                                            else handleUpdateClassification(expense.id, val);
                                                        }}
                                                    >
                                                        {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        <option value="Other">+ Other / Custom</option>
                                                    </select>
                                                    {customCategory && (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                autoFocus
                                                                className="bg-slate-50 dark:bg-slate-800 border-2 border-brand-500 rounded-xl px-3 py-1.5 text-xs font-bold w-full focus:outline-none"
                                                                value={customCategory}
                                                                placeholder="Type new category..."
                                                                onChange={(e) => setCustomCategory(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory(expense.id)}
                                                            />
                                                            <button onClick={() => handleAddCustomCategory(expense.id)} className="p-2 bg-emerald-600 text-white rounded-xl"><Check size={14} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div
                                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-brand-500 transition-all"
                                                    onClick={() => setEditingClassificationId(expense.id)}
                                                >
                                                    <Tag size={10} className="text-brand-500" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{expense.category}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-[10px] font-black text-slate-400 mr-1">{expense.currency}</span>
                                            <span className="text-sm font-black dark:text-white uppercase tracking-tight">{expense.amount.toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            {(() => {
                                                const src = expense.source || '';
                                                const label = src === 'bank_statement' ? 'BANK STATEMENT'
                                                    : src === 'credit_card_statement' ? 'CREDIT CARD'
                                                        : src === 'telegram' ? 'TELEGRAM BOT'
                                                            : src === 'whatsapp' ? 'WHATSAPP BOT'
                                                                : src === 'email' ? 'EMAIL'
                                                                    : src === 'forwarded_email' ? 'FORWARDED EMAIL'
                                                                        : src === 'web_upload' ? 'WEB UPLOAD'
                                                                            : src.replace(/_/g, ' ').toUpperCase();
                                                const isBot = src === 'telegram' || src === 'whatsapp';
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        {src === 'telegram' && <Send size={13} className="text-sky-500" />}
                                                        {src === 'whatsapp' && <MessageCircle size={13} className="text-emerald-500" />}
                                                        {src === 'bank_statement' && <Database size={13} className="text-amber-500" />}
                                                        {src === 'credit_card_statement' && <CreditCard size={13} className="text-indigo-500" />}
                                                        {src === 'email' && <Mail size={13} className="text-pink-500" />}
                                                        {src === 'forwarded_email' && <Mail size={13} className="text-pink-500" />}
                                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isBot ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                                : src.includes('statement') ? 'bg-sky-50 text-sky-600 border border-sky-100'
                                                                    : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                            }`}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-8 py-6">
                                            {(() => {
                                                const history = expense.usage_history || [];
                                                const latestLog = history[history.length - 1];
                                                const receiptOwner = expense.user_id || (expense as any).owner_email;
                                                const isShared = receiptOwner === 'SHARED_POOL';

                                                // Show if it's shared pool OR if someone else (like an Admin) used it
                                                const shouldShow = latestLog && (isShared || latestLog.user !== receiptOwner);

                                                if (!shouldShow) {
                                                    return <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Personal</span>;
                                                }

                                                return (
                                                    <div className="flex flex-col gap-1 group/audit relative">
                                                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 border border-brand-100 dark:border-brand-500/30 px-3 py-1.5 rounded-xl shadow-sm group-hover/audit:shadow-md transition-all">
                                                            <div className="p-1 bg-brand-600 rounded-lg text-white">
                                                                <ShieldCheck size={10} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest leading-none mb-0.5">Audited By</span>
                                                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-none">
                                                                    {latestLog.user.split('@')[0]}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-[8px] text-slate-400 font-bold uppercase ml-1 flex items-center gap-1">
                                                            <Calendar size={8} />
                                                            {new Date(latestLog.date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'travel' && (
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl p-8">
                    <TravelTracker logs={travelLogs} expenses={expenses} period={period} />
                </div>
            )}

            {view === 'reports' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {reports.map((report, idx) => {
                        const isExpanded = expandedReportId === report.id;
                        return (
                            <div key={idx} className={`bg-white dark:bg-[#0b1120] transition-all duration-500 overflow-hidden ${isExpanded ? 'border-brand-500 ring-[16px] ring-brand-500/5 rounded-[4rem] shadow-2xl mb-12' : 'border border-slate-100 dark:border-slate-800 shadow-sm rounded-[3rem] hover:border-brand-300 group'}`}>
                                <div className="p-8 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-8" onClick={() => setExpandedReportId(isExpanded ? null : report.id || null)}>
                                    <div className="flex items-center gap-6">
                                        <div className={`p-4 rounded-2xl shadow-sm transition-all ${isExpanded ? 'bg-brand-600 text-white' : 'bg-brand-50 dark:bg-brand-900/40 text-brand-600'}`}>
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{report.month} {report.year}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{report.user_id}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-10">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Matches</p>
                                                <p className="text-lg font-black text-emerald-500">{report.summary?.total_matched || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gaps</p>
                                                <p className="text-lg font-black text-red-500">{report.summary?.mandatory_error_count || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                                                <p className={`text-lg font-black ${(report.summary?.compliance_score || 0) > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{report.summary?.compliance_score || 0}%</p>
                                            </div>
                                        </div>
                                        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 transition-all ${isExpanded ? 'rotate-180 bg-brand-50 text-brand-600' : ''}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-10 pb-12 pt-2 bg-slate-50/20 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/60">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                                            <section className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                                <div className="px-8 py-4 bg-emerald-600 text-white flex items-center justify-between">
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Proof</h4>
                                                    <Check size={14} />
                                                </div>
                                                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                                                    {(report.matched_transactions || []).map((exp, idx) => (
                                                        <div key={idx} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                            <div>
                                                                <div className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-tight">{exp.merchant}</div>
                                                                <div className="text-[9px] text-slate-400 uppercase mt-1 leading-none">{exp.date} • {exp.category}</div>
                                                            </div>
                                                            <div className="text-right font-black text-slate-900 dark:text-white uppercase text-[11px]">
                                                                {exp.currency} {exp.amount.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(report.matched_transactions || []).length === 0 && (
                                                        <div className="p-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest leading-loose">No verified matches</div>
                                                    )}
                                                </div>
                                            </section>

                                            {report.mandatory_missing?.length > 0 && (
                                                <section className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] border border-red-100 dark:border-red-900/40 overflow-hidden shadow-sm">
                                                    <div className="px-8 py-4 bg-red-600 text-white flex items-center justify-between">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Hard Gaps</h4>
                                                        <AlertTriangle size={14} />
                                                    </div>
                                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                                                        {report.mandatory_missing.map((exp, idx) => (
                                                            <div key={idx} className="p-6 flex items-center justify-between hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <AlertTriangle size={14} className="text-red-500" />
                                                                    <div>
                                                                        <div className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-tight">{exp.merchant}</div>
                                                                        <div className="text-[9px] text-red-600 uppercase mt-1 leading-none">{exp.date} • {exp.category}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right font-black text-red-700 dark:text-red-400 uppercase text-[11px]">
                                                                    {exp.currency} {exp.amount.toFixed(2)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}

                                            {report.standard_missing?.length > 0 && (
                                                <section className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] border border-amber-100 dark:border-amber-900/40 overflow-hidden shadow-sm">
                                                    <div className="px-8 py-4 bg-amber-500 text-white flex items-center justify-between">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">General Missing</h4>
                                                        <FileQuestion size={14} />
                                                    </div>
                                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                                                        {report.standard_missing.map((exp, idx) => (
                                                            <div key={idx} className="p-6 flex items-center justify-between hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <FileQuestion size={14} className="text-amber-500" />
                                                                    <div>
                                                                        <div className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-tight">{exp.merchant}</div>
                                                                        <div className="text-[9px] text-amber-600 uppercase mt-1 leading-none">{exp.date} • {exp.category}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right font-black text-amber-700 dark:text-amber-400 uppercase text-[11px]">
                                                                    {exp.currency} {exp.amount.toFixed(2)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {reports.length === 0 && !isLoadingReports && (
                        <div className="col-span-full py-20 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                            <History size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No employee snapshots have been filed yet</p>
                        </div>
                    )}
                    {isLoadingReports && (
                        <div className="col-span-full py-20 text-center">
                            <div className="animate-spin text-brand-600 mx-auto mb-4"><Layers size={32} /></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrieving Secure Archives...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountMaster;
