import React, { useState, useEffect } from 'react';
import { ShieldCheck, Filter, CheckCircle2, AlertCircle, Settings, Users, ArrowUpRight, DollarSign } from 'lucide-react';
import { Expense } from '../types';
import { subscribeToAllExpenses, verifyExpense } from '../firebaseService';

interface AccountantPanelProps {
    evidenceThreshold: number;
    onThresholdChange: (newLimit: number) => void;
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

const AccountantPanel: React.FC<AccountantPanelProps> = ({ evidenceThreshold, onThresholdChange }) => {
    const [allExpenses, setAllExpenses] = useState<(Expense & { owner_email?: string })[]>([]);
    const [filter, setFilter] = useState<'pending' | 'verified'>('pending');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        return subscribeToAllExpenses(setAllExpenses);
    }, []);

    const filteredExpenses = allExpenses.filter(e => {
        if (filter === 'pending') return !e.is_verified;
        return e.is_verified;
    });

    const handleVerify = async (id: string, category: string, amount: number) => {
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Settings */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-brand-600" size={28} />
                        Master Audit Control
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                        Review across all employee sessions and set compliance policies.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/60">
                    <Settings className="text-slate-400" size={20} />
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Evidence Threshold (AED)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                value={evidenceThreshold}
                                onChange={(e) => onThresholdChange(Number(e.target.value))}
                                className="w-20 bg-transparent text-sm font-black outline-none border-b-2 border-brand-500/[0.15] focus:border-brand-500 transition-colors"
                                min="0"
                            />
                            <span className="text-[10px] font-bold text-slate-400 italic">Mandatory receipts above this limit</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-brand-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-brand-500/20">
                    <Users className="mb-4 opacity-50" size={32} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total Employees</p>
                    <p className="text-4xl font-black tabular-nums">{new Set(allExpenses.map(e => e.user_id)).size}</p>
                </div>
                <div className="bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60">
                    <AlertCircle className="mb-4 text-amber-500" size={32} />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pending Review</p>
                    <p className="text-4xl font-black tabular-nums">{allExpenses.filter(e => !e.is_verified).length}</p>
                </div>
                <div className="bg-white dark:bg-[#0b1120] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60">
                    <CheckCircle2 className="mb-4 text-emerald-500" size={32} />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Verified This Month</p>
                    <p className="text-4xl font-black tabular-nums">{allExpenses.filter(e => e.is_verified).length}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl w-fit">
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-md' : 'text-slate-500'}`}
                >
                    Pending Review
                </button>
                <button
                    onClick={() => setFilter('verified')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'verified' ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-md' : 'text-slate-500'}`}
                >
                    Verified Ledger
                </button>
            </div>

            {/* Main Table */}
            <div className="bg-white dark:bg-[#0b1120] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-900/40">
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Head</th>
                            <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                        {filteredExpenses.map((expense) => (
                            <tr key={expense.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                <td className="px-6 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold text-xs uppercase">
                                            {expense.owner_email ? expense.owner_email[0] : '?'}
                                        </div>
                                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 overflow-hidden text-ellipsis max-w-[120px]">{expense.owner_email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate max-w-[200px]">{expense.merchant}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">{expense.date}</p>
                                </td>
                                <td className="px-6 py-6">
                                    <div className="flex items-center gap-1 font-black text-brand-600">
                                        <span className="text-[10px] opacity-70">{expense.currency}</span>
                                        <span className="text-sm tabular-nums">{expense.amount.toFixed(2)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    {filter === 'pending' ? (
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-brand-500 transition-all dark:text-white"
                                            value={expense.accountant_category || ""}
                                            onChange={(e) => {
                                                expense.accountant_category = e.target.value;
                                                setAllExpenses([...allExpenses]);
                                            }}
                                        >
                                            <option value="">Select Ledger Head</option>
                                            {ACCOUNTANT_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="inline-flex px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                                            {expense.accountant_category}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-6 text-right">
                                    {filter === 'pending' ? (
                                        <button
                                            disabled={isUpdating === expense.id}
                                            onClick={() => handleVerify(expense.id, expense.accountant_category || "", expense.amount)}
                                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {isUpdating === expense.id ? <Settings className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                            Verify
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2 text-emerald-500 font-black text-[10px] uppercase">
                                            <CheckCircle2 size={16} />
                                            Verified
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredExpenses.length === 0 && (
                    <div className="py-20 flex flex-col items-center text-center">
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-full mb-4">
                            <ShieldCheck size={40} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em]">Queue is clean. No items to display.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountantPanel;
