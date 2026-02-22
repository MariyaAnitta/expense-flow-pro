
import React, { useState, useEffect, useMemo } from 'react';
import { HelpCircle, Search, CheckCircle2, Sparkles, AlertCircle, Save, ArrowRight, CornerDownRight, Zap, AlertTriangle, Clock } from 'lucide-react';
import { Expense } from '../types';

interface ClarificationCenterProps {
  expenses: Expense[];
  onResolve: (expenseId: string, updates: Partial<Expense>) => void;
  initialTargetId?: string | null;
  onClearTarget?: () => void;
}

const ClarificationCenter: React.FC<ClarificationCenterProps> = ({ expenses, onResolve, initialTargetId, onClearTarget }) => {
  const [userInput, setUserInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  const duplicateClusters = useMemo(() => {
    const map = new Map<string, Expense[]>();
    expenses.filter(e => e.source === 'telegram').forEach(e => {
      const key = `${e.merchant.toLowerCase()}-${e.amount}-${e.date}`;
      const existing = map.get(key) || [];
      map.set(key, [...existing, e]);
    });
    return Array.from(map.values()).filter(cluster => cluster.length > 1);
  }, [expenses]);

  const itemsToClarify = useMemo(() => {
    const standard = expenses.filter(e => (!e.category || e.category === 'Unknown' || (e.confidence || 0) < 0.7 || e.needs_clarification));
    const dupes = duplicateClusters.flat();
    const combined = [...standard];
    dupes.forEach(d => { if (!combined.find(c => c.id === d.id)) combined.push(d); });
    return combined;
  }, [expenses, duplicateClusters]);

  const [selectedId, setSelectedId] = useState<string | null>(initialTargetId || itemsToClarify[0]?.id || null);

  useEffect(() => { if (initialTargetId) { setSelectedId(initialTargetId); onClearTarget?.(); } }, [initialTargetId]);

  const activeItem = itemsToClarify.find(e => e.id === selectedId);
  const activeCluster = activeItem ? duplicateClusters.find(c => c.some(dupe => dupe.id === activeItem.id)) : null;

  const handleKeep = (id: string) => {
    // In a real app, you'd delete the others. For this prototype, we'll "resolve" it.
    onResolve(id, { needs_clarification: false, confidence: 1.0 });
    const remaining = itemsToClarify.filter(e => e.id !== id);
    setSelectedId(remaining[0]?.id || null);
  };

  const handleStandardResolve = () => {
    if (!activeItem) return;
    onResolve(activeItem.id, { merchant: userInput || activeItem.merchant, category: categoryInput || activeItem.category, needs_clarification: false, confidence: 1.0 });
    setUserInput(''); setCategoryInput('');
    const remaining = itemsToClarify.filter(e => e.id !== activeItem.id);
    setSelectedId(remaining[0]?.id || null);
  };

  if (itemsToClarify.length === 0) return (
    <div className="flex flex-col items-center justify-center py-40 text-center">
      <div className="bg-emerald-500/10 p-10 rounded-[3rem] mb-8 text-emerald-500"><CheckCircle2 size={80} /></div>
      <h3 className="text-3xl font-black uppercase tracking-tighter">Audit Clear</h3>
      <p className="text-slate-500 mt-2 font-medium">All cryptic and duplicate records resolved.</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <div className="w-full lg:w-96 space-y-3">
        <div className="flex items-center justify-between px-2 mb-4">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Queue ({itemsToClarify.length})</span>
           <Zap size={14} className="text-amber-500" />
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {itemsToClarify.map(item => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full p-6 rounded-[2rem] border text-left transition-all ${selectedId === item.id ? 'bg-white dark:bg-slate-900 border-brand-500 shadow-2xl ring-4 ring-brand-500/5' : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{item.date}</div>
              <div className="text-sm font-black dark:text-white uppercase truncate flex items-center gap-2">{item.merchant} {duplicateClusters.some(c => c.some(d => d.id === item.id)) && <AlertTriangle size={12} className="text-amber-500" />}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full">
        {activeItem && (
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className={`p-10 ${activeCluster ? 'bg-amber-50/50 dark:bg-amber-500/5' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
               <div className="flex items-center gap-5 mb-8">
                  <div className={`${activeCluster ? 'bg-amber-500' : 'bg-brand-600'} p-4 rounded-3xl text-white`}>
                    {activeCluster ? <AlertTriangle size={32} /> : <HelpCircle size={32} />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">{activeCluster ? 'Redundant Evidence' : 'Clarification Needed'}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{activeItem.clarification_reason || 'Manual Review'}</p>
                  </div>
               </div>

               {activeCluster ? (
                 <div className="space-y-6">
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-[2rem] text-amber-800 text-xs font-medium">Duplicate Cluster: Choose the primary record to keep for audit history.</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeCluster.map((dupe, i) => (
                        <div key={dupe.id} className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col justify-between h-full">
                           <div>
                             <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry {i + 1}</span>
                                <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(dupe.created_at || '').toLocaleTimeString()}</span>
                             </div>
                             <div className="text-sm font-black dark:text-white uppercase mb-2">{dupe.merchant}</div>
                             <div className="text-[10px] text-slate-500 font-bold uppercase mb-4">{dupe.currency} {dupe.amount} • {dupe.date}</div>
                           </div>
                           <button onClick={() => handleKeep(dupe.id)} className="w-full py-3 bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all">Keep Record {i + 1}</button>
                        </div>
                      ))}
                    </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 gap-8 bg-white dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Label</div><div className="text-xl font-black dark:text-white uppercase">{activeItem.merchant}</div></div>
                    <div className="text-right"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Value</div><div className="text-3xl font-black dark:text-white">{activeItem.currency} {activeItem.amount}</div></div>
                 </div>
               )}
            </div>

            <div className="p-10 space-y-8">
              {!activeCluster && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Real Business Name</label><input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="e.g. Starbucks #123" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-3xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all dark:text-white" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Category</label><input type="text" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} placeholder="e.g. Meals & Dining" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-3xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all dark:text-white" /></div>
                </div>
              )}
              {!activeCluster && <button onClick={handleStandardResolve} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.98]"><Save size={18} /> Update & Verify Record</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClarificationCenter;
