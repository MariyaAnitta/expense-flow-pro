import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  FileSearch, // Used for Compliance Audit
  TrendingUp,
  UploadCloud, // Changed from PlusCircle for Extractor
  RefreshCcw, // Used for audit button
  LogOut,
  HelpCircle, // Used for Resolutions
  Moon,
  Sun,
  Menu, // Used for mobile sidebar toggle
  X, // Used for mobile sidebar close
  ShieldCheck, // Used for Account Master and audit button
  Search, // Not explicitly used as an icon, but good to have if needed
  Maximize,
  Minimize,
  Plane, // Used for Travel Tracker
  History, // Changed from Archive for Data Archive
  Settings, // Used for System Settings
  CreditCard // Used for Bank Registry
} from 'lucide-react';
import { Expense, AppTab, ReconciliationResult, ReconciliationReport, TravelLog, AppSettings } from './types'; // Added AppSettings
import { reconcileData } from './geminiService';
import {
  subscribeToExpenses,
  subscribeToTelegramReceipts,
  subscribeToTravelLogs,
  addExpenses,
  addTravelLogs,
  removeExpense,
  updateExpense,
  subscribeToAllExpenses,
  subscribeToAllTelegramReceipts,
  subscribeToAllTravelLogs,
  subscribeToSettings, // Added
  updateSettings, // Added
  logReceiptUsage, // Added
  subscribeToBankRegistry // Added
} from './firebaseService';
import { getSession, signOut, UserSession } from './authService';
import { saveReconciliation } from './backendService';
import Dashboard from './components/Dashboard';
import Extractor from './components/Extractor';
import Reconciler from './components/Reconciler';
import Reports from './components/Reports';
import Auth from './components/Auth';
import ClarificationCenter from './components/ClarificationCenter';
import TravelTracker from './components/TravelTracker';
import AccountMaster from './components/AccountMaster';
import SystemSettings from './components/SystemSettings';
import BankRegistry from './components/BankRegistry';
import { subscribeToAuth } from './authService';

const App: React.FC = () => {
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [session, setSession] = useState<UserSession | null>(getSession());
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [internalExpenses, setInternalExpenses] = useState<Expense[]>([]);
  const [telegramExpenses, setTelegramExpenses] = useState<Expense[]>([]);
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [targetClarifyId, setTargetClarifyId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthsList[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [auditBank, setAuditBank] = useState<string>("All Accounts");
  const [evidenceThreshold, setEvidenceThreshold] = useState<number>(10);
  const [targetAuditee, setTargetAuditee] = useState<string>("Self"); // "Self" or employee email

  const [appSettings, setAppSettings] = useState<AppSettings>({ audit_threshold: 10, custom_expense_heads: [] }); // Added appSettings state
  const [bankMappings, setBankMappings] = useState<any[]>([]); // Added bankRegistry state

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  useEffect(() => {
    const unsubAuth = subscribeToAuth((updatedSession) => {
      setSession(updatedSession);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsub = subscribeToSettings(setAppSettings); // Subscribing to settings
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!session) return;
    const unsub = subscribeToBankRegistry(setBankMappings);
    return () => unsub();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let unsubInternal: () => void;
    let unsubTelegram: () => void;
    let unsubTravel: () => void;

    if (session.role === 'admin') { // Changed from session.isAdmin
      // Admin sees everything
      unsubInternal = subscribeToAllExpenses(setInternalExpenses);
      unsubTelegram = subscribeToAllTelegramReceipts(setTelegramExpenses);
      unsubTravel = subscribeToAllTravelLogs(setTravelLogs);
    } else {
      // Employee sees only their own
      unsubInternal = subscribeToExpenses(setInternalExpenses);
      unsubTelegram = subscribeToTelegramReceipts(setTelegramExpenses);
      unsubTravel = subscribeToTravelLogs(setTravelLogs);
    }

    return () => {
      unsubInternal?.();
      unsubTelegram?.();
      unsubTravel?.();
    };
  }, [session]);

  // UNIFIED FILTERING LOGIC
  const currentUserEmail = targetAuditee === "Self" ? session?.email : targetAuditee;

  const filteredExpenses = useMemo(() => {
    const combined = [...internalExpenses, ...telegramExpenses];

    // IF ON DASHBOARD: Admin sees ONLY their own data
    // IF ON ACCOUNT MASTER: Admin sees FILTERED/GLOBAL data
    const isDashboard = activeTab === AppTab.DASHBOARD;
    const effectiveAuditee = isDashboard ? "Self" : targetAuditee;
    const auditeeEmail = effectiveAuditee === "Self" ? session?.email : effectiveAuditee;

    return combined
      .filter(e => {
        const uId = (e as any).user_id || (e as any).owner_email;
        const userMatch = !auditeeEmail || auditeeEmail === "All Employees" || uId === auditeeEmail || uId === 'SHARED_POOL';

        // Month/Year filter for non-dashboard views if needed,
        // but user specifically mentioned sorting by year/month in Account Master
        return userMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [internalExpenses, telegramExpenses, targetAuditee, session, activeTab]);

  const filteredTravelLogs = useMemo(() => {
    return travelLogs.filter(l => {
      const uId = (l as any).user_id || (l as any).owner_email;
      const matchesUser = !currentUserEmail || uId === currentUserEmail || uId === 'SHARED_POOL';

      if (!l.start_date) return matchesUser;

      const parts = l.start_date.split('-');
      if (parts.length < 2) return matchesUser;

      const lYear = parseInt(parts[0]);
      const lMonthIndex = parseInt(parts[1]) - 1;
      const matchesPeriod = lYear === selectedYear && (selectedMonth === "All Months" || monthsList[lMonthIndex] === selectedMonth);

      return matchesUser && matchesPeriod;
    });
  }, [travelLogs, currentUserEmail, selectedMonth, selectedYear, monthsList]);

  const handleLogout = () => { signOut(); setSession(null); };

  const handleResolveClarification = async (id: string, updates: Partial<Expense>) => {
    try { await updateExpense(id, updates); } catch (err) { console.error(err); }
  };

  const handleAddData = async (data: { expenses: Expense[], travelLogs: TravelLog[] }) => {
    console.log("🚀 App: handleAddData received:", data);
    console.log(`   - Expenses: ${data.expenses.length}`);
    console.log(`   - Travel: ${data.travelLogs.length}`);

    try {
      if (!session?.email) {
        console.error("❌ App: No session email found, cannot save data.");
        return;
      }

      // Detect the period of the uploaded data to auto-update filters
      if (data.expenses.length > 0) {
        const firstExp = data.expenses[0];
        if (firstExp.date) {
          const [y, m] = firstExp.date.split('-');
          const yearNum = parseInt(y);
          const monthIdx = parseInt(m) - 1;
          if (!isNaN(yearNum) && monthsList[monthIdx]) {
            console.log(`📅 App: Auto-setting period to ${monthsList[monthIdx]} ${yearNum}`);
            setSelectedMonth(monthsList[monthIdx]);
            setSelectedYear(yearNum);
          }
        }
      }

      if (data.expenses.length > 0) {
        console.log("   - Preparing to save to Firebase...");
        const expensesToInsert = data.expenses.map(({ id, ...rest }) => ({ ...rest, user_id: session.email }));
        await addExpenses(expensesToInsert);
      }
      if (data.travelLogs.length > 0) {
        console.log("   - Preparing to save Travel Logs...");
        const logsToInsert = data.travelLogs.map(({ id, ...rest }) => ({ ...rest, user_id: session.email }));
        await addTravelLogs(logsToInsert);
      }

      if (data.expenses.some(e => e.needs_clarification)) {
        console.log("   - Clarification needed, switching tab.");
        setActiveTab(AppTab.RESOLVE);
      } else {
        console.log("   - Extraction successful, switching to Dashboard.");
        setActiveTab(AppTab.DASHBOARD);
      }
      console.log("✅ App: handleAddData complete.");
    } catch (err) {
      console.error("❌ App: Error in handleAddData:", err);
    }
  };

  const handleSaveReport = async (report: ReconciliationReport) => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveReconciliation(report);

      // Audit Trail Implementation: Log usage for all receipts matched in this period
      const receiptsToLog = report.matched_receipts || [];
      console.log(`📝 App: Logging usage for ${receiptsToLog.length} receipts...`);
      for (const receipt of receiptsToLog) {
        if (session?.email && receipt.id) {
          await logReceiptUsage(receipt.id, session.email, 'Matched during Audit');
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleJumpToClarify = useCallback((id: string) => {
    setTargetClarifyId(id);
    setActiveTab(AppTab.RESOLVE); // Changed from AppTab.CLARIFY
  }, []);

  /**
   * ROBUST CROSS-PERIOD RECONCILIATION
   * Focuses on finding PROOF for current period ANCHORS.
   */
  const handleInitiateAudit = async () => {
    setIsProcessing(true);
    try {
      // 1. ANCHORS: Only Bank/Card records for the selected month
      const anchorsInPeriod = filteredExpenses.filter(e => {
        const src = String(e.source || '').toLowerCase().trim();
        const isBankAnchor = src === 'bank_statement' || src === 'credit_card_statement';
        if (!isBankAnchor || !e.date) return false;

        const parts = e.date.split('-');
        if (parts.length < 2) return false;
        const eYear = parseInt(parts[0]);
        const eMonthIndex = parseInt(parts[1]) - 1;

        // EXPANDED ANCHOR LOGIC: Include current month AND the following month
        // logic: if auditing Jan, we need Feb bank records to catch hotel settlements.
        const isCurrentPeriod = eYear === selectedYear && (selectedMonth === "All Months" || monthsList[eMonthIndex] === selectedMonth);

        // Check if it's the following month
        const targetMonthIndex = monthsList.indexOf(selectedMonth);
        const isNextMonth = selectedMonth !== "All Months" && (
          (eYear === selectedYear && eMonthIndex === targetMonthIndex + 1) ||
          (eYear === selectedYear + 1 && targetMonthIndex === 11 && eMonthIndex === 0)
        );

        const periodMatch = isCurrentPeriod || isNextMonth;
        const bankMatch = auditBank === "All Accounts" || e.bank === auditBank;

        return periodMatch && bankMatch;
      });

      // 2. PROOF POOL: Everything else (Receipts, Telegram, etc.)
      const allProofs = filteredExpenses.filter(e => {
        const src = String(e.source || '').toLowerCase().trim();
        return src !== 'bank_statement' && src !== 'credit_card_statement';
      });

      if (anchorsInPeriod.length === 0) {
        alert(`No bank records found for ${selectedMonth} ${selectedYear}. Please upload a statement first.`);
        setIsProcessing(false);
        return;
      }

      // 3. Label roles for the AI Forensic Auditor
      const auditPool = [
        ...anchorsInPeriod.map(e => ({ ...e, role: 'ANCHOR' as const })),
        ...allProofs.map(e => ({ ...e, role: 'PROOF' as const }))
      ];

      // Reconcile anchors with all possible proofs
      const res = await reconcileData(auditPool);
      setReconciliation(res);
      setActiveTab(AppTab.RECONCILE);
    } catch (err) {
      console.error("Audit Failure:", err);
      alert("Audit process interrupted. Retrying...");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!session) return <Auth onAuthenticated={(sess) => setSession(sess)} />;

  if (session.role === 'pending') {
    return (
      <div className="h-screen w-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-400 to-brand-600" />
          <div className="w-24 h-24 bg-brand-50 dark:bg-brand-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-brand-600 dark:text-brand-400 rotate-3">
            <ShieldCheck size={48} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter dark:text-white uppercase mb-4">Account Pending</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-10">
            Welcome to <span className="text-brand-600 font-black">ExpenseFlow</span>.<br />
            Your account <span className="text-slate-900 dark:text-white font-bold">({session.email})</span> is currently waiting for administrator approval.
          </p>
          <div className="flex flex-col gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Action Required: Contact your Admin
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all active:scale-95"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const clarificationCount = filteredExpenses.filter(e => (!e.category || e.category === 'Unknown' || (e.confidence || 0) < 0.7 || e.needs_clarification)).length;

  const NavItem = ({ tab, icon: Icon, label, count }: { tab: AppTab, icon: any, label: string, count?: number }) => (
    <button
      onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
      className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === tab ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
        }`}
    >
      <div className="flex items-center gap-3"><Icon size={20} className={activeTab === tab ? 'text-white' : 'text-slate-400'} />{label}</div>
      {count !== undefined && count > 0 && <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>{count}</span>}
    </button>
  );

  return (
    <div className="h-screen bg-slate-50 dark:bg-[#020617] flex font-sans overflow-hidden text-slate-900 dark:text-slate-100">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed md:relative z-50 w-72 h-full bg-white dark:bg-[#0b1120] border-r border-slate-200 dark:border-slate-800/60 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-12 px-2"><div className="flex items-center gap-3"><div className="bg-brand-600 p-2.5 rounded-2xl text-white"><TrendingUp size={22} /></div><span className="text-xl font-black tracking-tighter">ExpenseFlow</span></div><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X /></button></div>
          <nav className="flex-1 space-y-2">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 mb-4">Operations</div>
            <div className="flex flex-col gap-2">
              <NavItem tab={AppTab.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
              <NavItem tab={AppTab.EXTRACT} icon={UploadCloud} label="Upload Document" /> {/* Changed icon */}
              <NavItem tab={AppTab.TRAVEL} icon={Plane} label="Travel Tracker" />
              <NavItem tab={AppTab.RESOLVE} icon={HelpCircle} label="Resolutions" count={clarificationCount} /> {/* Changed tab name */}

              <div className="mt-8 mb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-50">Audit & Compliance</div>
              <NavItem tab={AppTab.RECONCILE} icon={FileSearch} label="Compliance Audit" />
              <NavItem tab={AppTab.REPORTS} icon={History} label="Data Archive" /> {/* Changed icon */}

              {session.role === 'admin' && ( // Changed from session.isAdmin
                <>
                  <div className="mt-8 mb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-50">Administration</div>
                  <NavItem tab={AppTab.ACCOUNT_MASTER} icon={ShieldCheck} label="Account Master" /> {/* Changed tab name */}
                  <NavItem tab={AppTab.SYSTEM_SETTINGS} icon={Settings} label="System Settings" /> {/* Added */}
                  <NavItem tab={AppTab.BANK_REGISTRY} icon={CreditCard} label="Bank Registry" /> {/* Added */}
                </>
              )}
            </div>
          </nav>
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/60"><div className="bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/40"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-xs">{session.email.charAt(0).toUpperCase()}</div><div className="overflow-hidden"><p className="text-xs font-black truncate">{session.email}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Financial Admin</p></div></div><div className="flex gap-2"><button onClick={() => setDarkMode(!darkMode)} className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button><button onClick={handleLogout} className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500"><LogOut size={16} /></button></div></div></div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 flex items-center justify-between px-6 bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/60 shrink-0 z-30">
          <div className="flex items-center gap-6"><button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl"><Menu /></button><h2 className="text-lg font-black tracking-tight uppercase">{activeTab.toUpperCase()}</h2></div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/60 mr-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 px-4 py-2 outline-none">
                {["All Months", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m} className="dark:bg-[#0b1120]">{m}</option>)}
              </select>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 px-4 py-2 outline-none">
                {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y} className="dark:bg-[#0b1120]">{y}</option>)}
              </select>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
              <select value={auditBank} onChange={(e) => setAuditBank(e.target.value)} className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 px-4 py-2 outline-none">
                {["All Accounts", "Amex", "Citi", "HSBC", "Standard Chartered", "Other"].map(b => <option key={b} value={b} className="dark:bg-[#0b1120]">{b}</option>)}
              </select>
            </div>
            <button onClick={toggleFullscreen} className="p-3 text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all shadow-sm border border-slate-200 dark:border-slate-800/60">{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
            <button
              onClick={handleInitiateAudit}
              disabled={isProcessing}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] flex items-center gap-3 hover:bg-brand-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? <RefreshCcw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              {isProcessing ? 'Auditing Ledger...' : 'Initiate Audit'}
            </button>
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] dark:bg-[#020617]">
          <div className="max-w-screen-xl mx-auto">
            {activeTab === AppTab.DASHBOARD && <Dashboard expenses={filteredExpenses} onDelete={removeExpense} onUpdate={updateExpense} period={{ month: selectedMonth, year: selectedYear }} onNavigateToClarify={setTargetClarifyId} filterBank={auditBank} onFilterBankChange={setAuditBank} session={session} customCategories={appSettings.custom_expense_heads} bankMappings={bankMappings} />}
            {activeTab === AppTab.EXTRACT && <Extractor onExtract={handleAddData} bankMappings={bankMappings} />}
            {activeTab === AppTab.TRAVEL && <TravelTracker logs={filteredTravelLogs} expenses={filteredExpenses} period={{ month: selectedMonth, year: selectedYear }} />}
            {activeTab === AppTab.RESOLVE && <ClarificationCenter expenses={filteredExpenses} onResolve={handleResolveClarification} initialTargetId={targetClarifyId} onClearTarget={() => setTargetClarifyId(null)} />} {/* Changed tab name */}
            {activeTab === AppTab.RECONCILE && <Reconciler expenses={filteredExpenses} reconciliation={reconciliation} isProcessing={isProcessing} period={{ month: selectedMonth, year: selectedYear }} onSaveReport={handleSaveReport} isSaving={isSaving} saveSuccess={saveSuccess} auditBank={auditBank} onBankChange={setAuditBank} evidenceThreshold={appSettings.audit_threshold} currentUserEmail={session.email} />} {/* Passed appSettings.audit_threshold and currentUserEmail */}
            {activeTab === AppTab.REPORTS && <Reports period={{ month: selectedMonth, year: selectedYear }} session={session} />}
            {activeTab === AppTab.ACCOUNT_MASTER && (
              <AccountMaster
                expenses={filteredExpenses}
                travelLogs={filteredTravelLogs}
                targetAuditee={targetAuditee}
                onAuditeeChange={setTargetAuditee}
                period={{ month: selectedMonth, year: selectedYear }}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
                settings={appSettings}
                customCategories={appSettings.custom_expense_heads}
                allExpenses={[...internalExpenses, ...telegramExpenses]}
                session={session}
              />
            )}
            {activeTab === AppTab.SYSTEM_SETTINGS && (
              <SystemSettings
                settings={appSettings}
                onUpdate={updateSettings}
              />
            )}
            {activeTab === AppTab.BANK_REGISTRY && <BankRegistry mappings={bankMappings} />}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
