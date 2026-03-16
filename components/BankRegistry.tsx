import React, { useState } from 'react';
import {
    CreditCard,
    Plus,
    X,
    Shield,
    Save,
    AlertCircle,
    Trash2
} from 'lucide-react';
import { saveBankMapping, deleteBankMapping } from '../firebaseService';

interface BankRegistryProps {
    mappings: any[];
}

const BankRegistry: React.FC<BankRegistryProps> = ({ mappings }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newMapping, setNewMapping] = useState({ card_digits: '', bank_name: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMapping.card_digits.length !== 4) {
            alert("Card digits must be exactly 4 numbers.");
            return;
        }
        setIsSaving(true);
        try {
            await saveBankMapping(newMapping);
            setNewMapping({ card_digits: '', bank_name: '' });
            setIsAdding(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this mapping?")) {
            try {
                await deleteBankMapping(id);
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* HEADER SECTION */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[2rem] bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
                            <CreditCard size={32} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter dark:text-white uppercase">Card-to-Bank Registry</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Automatic "Auto-Pilot" Classification</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-brand-500/20"
                    >
                        <Plus size={18} />
                        Add New Mapping
                    </button>
                </div>
            </div>

            {/* GRID OF MAPPINGS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mappings.length === 0 ? (
                    <div className="col-span-full bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] p-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Shield size={40} />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-2">No Mappings Found</h4>
                        <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">
                            Create your first card-to-bank link to enable automated receipt classification.
                        </p>
                    </div>
                ) : (
                    mappings.map((m) => (
                        <div key={m.id} className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400">
                                    <CreditCard size={24} />
                                </div>
                                <button
                                    onClick={() => handleDelete(m.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last 4 Digits</p>
                                    <p className="text-3xl font-black dark:text-white tracking-tighter">•••• {m.card_digits}</p>
                                </div>
                                <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mapped Bank</p>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg text-[11px] font-black uppercase tracking-wider">
                                        {m.bank_name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ADD MODAL */}
            {isAdding && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setIsAdding(false)} />

                    <form onSubmit={handleSave} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white">
                                        <Plus size={24} />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tighter uppercase dark:text-white">Create Mapping</h3>
                                </div>
                                <button type="button" onClick={() => setIsAdding(false)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Card Last 4 Digits</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        required
                                        placeholder="e.g. 4477"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                                        value={newMapping.card_digits}
                                        onChange={(e) => setNewMapping({ ...newMapping, card_digits: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Assigned Bank Name</label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                                        value={["Amex", "Citi", "HSBC", "Standard Chartered", ""].includes(newMapping.bank_name) ? newMapping.bank_name : 'Other'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'Other') {
                                                setNewMapping({ ...newMapping, bank_name: '' });
                                            } else {
                                                setNewMapping({ ...newMapping, bank_name: val });
                                            }
                                        }}
                                    >
                                        <option value="">Select Bank</option>
                                        {["Amex", "Citi", "HSBC", "Standard Chartered"].map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                        <option value="Other">Other (Type Name...)</option>
                                    </select>
                                </div>

                                {(newMapping.bank_name !== '' && !["Amex", "Citi", "HSBC", "Standard Chartered"].includes(newMapping.bank_name)) && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 text-brand-500">Specify Bank Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Emirates NBD"
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-brand-200 dark:border-brand-900 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                                            value={newMapping.bank_name}
                                            onChange={(e) => setNewMapping({ ...newMapping, bank_name: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-2xl mt-8 flex gap-3">
                                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                <p className="text-[10px] font-medium text-amber-700 dark:text-amber-500 leading-relaxed">
                                    Once saved, receipts containing these digits will be automatically tagged with this bank account during extraction.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="flex-1 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <Save size={18} />
                                {isSaving ? 'Processing...' : 'Save Mapping'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default BankRegistry;
