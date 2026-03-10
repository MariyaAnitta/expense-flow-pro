import React, { useState, useMemo } from 'react';
import {
    Expense,
    TravelLog,
    AppSettings
} from '../types';
import {
    updateExpense,
    verifyExpense
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
    Check
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
    allExpenses = []
}) => {
    const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null);
    const [editingClassificationId, setEditingClassificationId] = useState<string | null>(null);
    const [tempIdentity, setTempIdentity] = useState("");
    const [customCategory, setCustomCategory] = useState("");

    const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const allUsers = useMemo(() => {
        const sourceData = allExpenses.length > 0 ? allExpenses : expenses;
        return Array.from(new Set(sourceData.map(e => (e as any).owner_email || (e as any).user_id).filter(Boolean))) as string[];
    }, [allExpenses, expenses]);

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

            {/* Global Ledger */}
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
                                                    {(expense as any).owner_email === 'SHARED_POOL' || expense.user_id === 'SHARED_POOL' ? 'SHARED POOL' : ((expense as any).owner_email || expense.user_id || 'System')}
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
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${expense.source.includes('statement')
                                            ? 'bg-sky-50 text-sky-600 border border-sky-100'
                                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                            }`}>
                                            {expense.source.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        {expense.usage_history && expense.usage_history.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {expense.usage_history.slice(-1).map((log, i) => (
                                                    <div key={i} className="text-[9px] font-bold text-slate-500 uppercase">
                                                        <span className="text-brand-600">USED BY:</span> {log.user.split('@')[0]}
                                                        <div className="text-[8px] text-slate-400">{new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">No History</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AccountMaster;
