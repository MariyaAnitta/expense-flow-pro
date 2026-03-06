import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import {
    Shield,
    Save,
    AlertCircle,
    Info
} from 'lucide-react';

interface SystemSettingsProps {
    settings: AppSettings;
    onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({ settings, onUpdate }) => {
    const [threshold, setThreshold] = useState(settings.audit_threshold);
    const [isSaving, setIsSaving] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(() => new Date().toLocaleString());

    useEffect(() => {
        setThreshold(settings.audit_threshold);
    }, [settings.audit_threshold]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate({
                audit_threshold: threshold
            });
            setLastUpdate(new Date().toLocaleString());
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* AUDIT CONFIGURATION SECTION */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tighter dark:text-white uppercase">Audit Configuration</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Global Compliance Rules For All Users</p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <div>
                            <h4 className="text-sm font-black dark:text-white uppercase tracking-wider mb-2">Mandatory Proof Threshold</h4>
                            <p className="text-xs font-medium text-slate-500 max-w-lg leading-relaxed">
                                Any expense above this amount will require a verified receipt or invoice for reconciliation.
                            </p>
                        </div>
                        <div className="inline-flex py-1.5 px-4 bg-brand-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap shrink-0 items-center justify-center">
                            Active<br />Rule
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400">AED</span>
                            </div>
                            <input
                                type="number"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-5 pl-16 pr-8 text-xl font-black focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all dark:text-white"
                                value={threshold}
                                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center justify-center min-w-[200px] gap-3 px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isSaving
                                ? 'bg-brand-300 text-white cursor-not-allowed'
                                : 'bg-brand-400 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20 active:scale-95'
                                }`}
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* IMPACT WARNING */}
                <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/50 p-6 rounded-[2rem] flex items-start gap-4">
                    <AlertCircle size={20} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h5 className="text-xs font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-1">Impact Warning</h5>
                        <p className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                            Changing this threshold will immediately affect the "Compliance Score" and "Mandatory Missing" flags for all employees across all active audit periods.
                        </p>
                    </div>
                </div>
            </div>

            {/* SYSTEM INFORMATION SECTION */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                        <Info size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tighter dark:text-white uppercase">System Information</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Version & Environment</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Last Config Update</p>
                        <p className="text-sm font-bold dark:text-white">{lastUpdate}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Environment</p>
                        <p className="text-sm font-black text-emerald-600 uppercase tracking-wider">Production Ready</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;

