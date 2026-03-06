import React, { useState, useEffect } from 'react';
import {
    ShieldCheck,
    Filter,
    CheckCircle2,
    AlertCircle,
    Settings,
    Users,
    ArrowUpRight,
    DollarSign,
    Layers,
    FileText,
    History,
    CheckSquare,
    Square,
    Plane
} from 'lucide-react';
import { Expense, ReconciliationReport, TravelLog } from '../types';
import { verifyExpense, fetchReportsFromCloud, subscribeToAllTravelLogs } from '../firebaseService';
import TravelTracker from './TravelTracker';

interface AccountantPanelProps {
    expenses: (Expense & { owner_email?: string })[];
    travelLogs: (TravelLog & { owner_email?: string })[];
    evidenceThreshold: number;
    onThresholdChange: (newLimit: number) => void;
    targetAuditee: string;
    onAuditeeChange: (newUser: string) => void;
    period: { month: string; year: number };
}

const ACCOUNTANT_CATEGORIES = [
    "Staff Travel - International",
    "Staff Travel - Domestic",
    "Client Hospitality",
    "Office Supplies & Stationary",
    "Utilities - Electricity/Water",
    "Marketing & Promotions",
    "Subscriptions & Software",
    "Miscellaneous"
];

const AccountantPanel: React.FC<AccountantPanelProps> = ({
    expenses,
    travelLogs,
    evidenceThreshold,
    onThresholdChange,
    targetAuditee,
    onAuditeeChange,
    period
}) => {
    const [reports, setReports] = useState<(ReconciliationReport & { user_id?: string })[]>([]);
    const [view, setView] = useState<'ledger' | 'reports' | 'travel'>('ledger');
    const [filter, setFilter] = useState<'pending' | 'verified'>('pending');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchCategory, setBatchCategory] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchReportsFromCloud().then(setReports);
    }, []);

    const allUsers = Array.from(new Set(expenses.map(e => e.owner_email).filter(Boolean))) as string[];

    const filteredExpenses = expenses.filter(e => {
        const matchesStatus = filter === 'pending' ? !e.is_verified : e.is_verified;
        const matchesUser = targetAuditee === "Self" || targetAuditee === "All Users" || e.owner_email === targetAuditee || e.user_id === targetAuditee;
        return matchesStatus && matchesUser;
    });

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredExpenses.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
    };

    const handleBatchVerify = async () => {
        if (selectedIds.size === 0) return;
        if (!batchCategory) {
            alert("Please select a Master Category for batch verification");
            return;
        }

        setIsUpdating("batch");
        try {
            for (const id of Array.from(selectedIds)) {
                const exp = expenses.find(e => e.id === id);
                if (exp) {
                    await verifyExpense(id, {
                        accountant_category: batchCategory,
                        verified_amount: exp.amount
                    });
                }
            }
            setSelectedIds(new Set());
            setBatchCategory("");
        } catch (err) {
            console.error(err);
            alert("Failed some batch verifications");
        } finally {
            setIsUpdating(null);
        }
    };

    const handleVerifySingle = async (id: string, category: string, amount: number) => {
        if (!category) {
            alert("Please select an Expense Head first");
            return;
        }
        setIsUpdating(id);
        try {
            await verifyExpense(id, {
                accountant_category: category,
                verified_amount: amount
            });
        } catch (err) {
            console.error(err);
            alert("Failed to verify expense");
        } finally {
            setIsUpdating(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-32">
            {/* Header & Settings */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-brand-600" size={28} />
                        Master Audit Control
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                        Cross-user oversight and compliance policy management.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/60">
                    <Settings className="text-slate-400" size={20} />
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Receipt Threshold (AED)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                value={evidenceThreshold}
                                onChange={(e) => onThresholdChange(Number(e.target.value))}
                                className="w-20 bg-transparent text-sm font-black outline-none border-b-2 border-brand-500/[0.15] focus:border-brand-500 transition-colors"
                                min="0"
                            />
                            <span className="text-[10px] font-bold text-slate-400 italic">Global limit for auto-flagging</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Switches */}
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

                <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl w-fit items-center gap-2">
                    <Users size={14} className="ml-3 text-slate-400" />
                    <select
                        value={targetAuditee}
                        onChange={(e) => onAuditeeChange(e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 px-4 py-1 outline-none cursor-pointer"
                    >
                        <option value="Self">My View</option>
                        <option value="All Users">All Employees</option>
                        {allUsers.map(user => (
                            <option key={user} value={user}>{user}</option>
                        ))}
                    </select>
                </div>

                {view === 'ledger' && (
                    <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl w-fit ml-auto">
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-md' : 'text-slate-500'}`}
                        >
                            Pending Review {targetAuditee !== "Self" && targetAuditee !== "All Users" && `(${targetAuditee.split('@')[0]})`}
                        </button>
                        <button
                            onClick={() => setFilter('verified')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'verified' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-md' : 'text-slate-500'}`}
                        >
                            History
                        </button>
                    </div>
                )}
            </div>

            {view === 'ledger' ? (
                <div className="space-y-6">
                    {/* Batch Action Bar */}
                    {filter === 'pending' && selectedIds.size > 0 && (
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-6 rounded-[2rem] border border-brand-100 dark:border-brand-500/20 flex items-center justify-between animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-4">
                                <div className="bg-brand-600 p-2 rounded-xl text-white"><CheckSquare size={18} /></div>
                                <div>
                                    <p className="text-sm font-black text-brand-900 dark:text-brand-100 uppercase">{selectedIds.size} Items Selected</p>
                                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Apply master head and verify all</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <select
                                    className="bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-[11px] font-black outline-none shadow-sm focus:ring-2 ring-brand-500/30"
                                    value={batchCategory}
                                    onChange={(e) => setBatchCategory(e.target.value)}
                                >
                                    <option value="">Choose Batch Head</option>
                                    {ACCOUNTANT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button
                                    onClick={handleBatchVerify}
                                    disabled={isUpdating === "batch"}
                                    className="bg-brand-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
                                >
                                    {isUpdating === "batch" ? <Settings className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                    Finalize Batch
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/40">
                                    <th className="px-6 py-5 w-12">
                                        <button onClick={handleSelectAll} className="text-slate-300 hover:text-brand-500 transition-colors">
                                            {selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Outcome</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                                {filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors ${selectedIds.has(expense.id) ? 'bg-brand-50/30 dark:bg-brand-900/10' : ''}`}>
                                        <td className="px-6 py-6">
                                            <button onClick={() => handleToggleSelect(expense.id)} className={`${selectedIds.has(expense.id) ? 'text-brand-600' : 'text-slate-200 group-hover:text-slate-300'}`}>
                                                {selectedIds.has(expense.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-[10px] uppercase">
                                                    {expense.owner_email ? expense.owner_email[0] : '?'}
                                                </div>
                                                <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 overflow-hidden text-ellipsis max-w-[120px]">{expense.owner_email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight">
                                            {expense.merchant}
                                            <p className="text-[10px] text-slate-400 font-bold tracking-normal mt-0.5 lowercase">{expense.date}</p>
                                        </td>
                                        <td className="px-6 py-6 text-right font-black text-slate-900 dark:text-white">
                                            <span className="text-[10px] opacity-40 mr-1">{expense.currency}</span>
                                            {expense.amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-6">
                                            {filter === 'pending' ? (
                                                <select
                                                    className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-black outline-none focus:border-brand-500 transition-all dark:text-white uppercase tracking-tighter cursor-not-allowed"
                                                    value={expense.accountant_category || ""}
                                                    disabled
                                                >
                                                    <option value="">Pending Auditor Input</option>
                                                    {ACCOUNTANT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>
                                            ) : (
                                                <span className="inline-flex px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                                    {expense.accountant_category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            {filter === 'pending' ? (
                                                <button
                                                    disabled={isUpdating === expense.id || isUpdating === "batch"}
                                                    onClick={() => handleVerifySingle(expense.id, expense.accountant_category || "", expense.amount)}
                                                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                                >
                                                    {isUpdating === expense.id ? <Settings className="animate-spin" size={14} /> : <CheckCircle2 size={12} />}
                                                    Confirm
                                                </button>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2 text-emerald-500 font-black text-[9px] uppercase tracking-widest">
                                                    <CheckCircle2 size={14} />
                                                    Audited
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredExpenses.length === 0 && (
                            <div className="py-24 text-center">
                                <ShieldCheck size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Zero entries found</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : view === 'travel' ? (
                <div className="animate-in slide-in-from-bottom-4">
                    <TravelTracker
                        logs={travelLogs}
                        expenses={expenses}
                        period={period}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
                    {reports.filter(r => targetAuditee === "Self" || targetAuditee === "All Users" || r.user_id === targetAuditee).map((report, idx) => (
                        <div key={idx} className="bg-white dark:bg-[#0b1120] p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-brand-300 transition-all group">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600"><FileText size={24} /></div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{report.month} {report.year}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{report.user_id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                                    <p className={`text-4xl font-black tracking-tighter ${(report.summary?.compliance_score || 0) > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{report.summary?.compliance_score}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Matches</p>
                                    <p className="text-lg font-black text-emerald-500">{report.summary?.total_matched}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gaps</p>
                                    <p className="text-lg font-black text-red-500">{report.summary?.mandatory_error_count}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Matches %</p>
                                    <p className="text-lg font-black text-slate-700 dark:text-slate-300">{report.summary?.compliance_score}%</p>
                                </div>
                            </div>

                            <button className="w-full py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-[0.2em] group-hover:bg-brand-600 group-hover:text-white group-hover:border-brand-600 transition-all">
                                Open Audit Blueprint
                            </button>
                        </div>
                    ))}
                    {reports.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                            <History size={40} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No employee snapshots have been filed yet</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountantPanel;
