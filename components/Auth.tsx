import React, { useState } from 'react';
import { Mail, Lock, Sparkles, TrendingUp, Loader2, ArrowRight, UserPlus, LogIn, AlertCircle, KeyRound, ShieldCheck, ChevronLeft, HelpCircle } from 'lucide-react';
import { signIn, signUp, resetPassword, UserSession } from '../authService';

interface AuthProps {
  onAuthenticated: (session: UserSession) => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

const Auth: React.FC<AuthProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const session = await signIn(email, password);
        onAuthenticated(session);
      } else if (mode === 'signup') {
        if (!recoveryPhrase) throw new Error("Please set a recovery phrase");
        const session = await signUp(email, password, recoveryPhrase);
        onAuthenticated(session);
      } else if (mode === 'reset') {
        await resetPassword(email, recoveryPhrase, password);
        setSuccessMsg("Success! Security updated. Please sign in.");
        setMode('login');
        setPassword('');
        setRecoveryPhrase('');
      }
    } catch (err: any) {
      setError(err.message || "Credential verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center bg-slate-50 dark:bg-slate-950 p-6 relative overflow-y-auto transition-colors duration-300">
      {/* Premium Background Effects - Immersive but subtle */}
      <div className="absolute top-[-25%] right-[-15%] w-[70%] h-[70%] bg-brand-500/10 rounded-full blur-[160px] animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-15%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] animate-pulse delay-700"></div>

      <div className="w-full max-w-lg relative z-10 flex flex-col items-center py-4">
        {/* Logo Section - Optimized vertical footprint */}
        <div className="flex flex-col items-center mb-3 animate-in fade-in slide-in-from-top-4 duration-1000 text-center">
          <div className="bg-brand-600 p-3 rounded-2xl text-white shadow-3xl shadow-brand-500/20 mb-3">
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">ExpenseFlow <span className="text-brand-600">Pro</span></h1>
          <p className="text-slate-400 dark:text-slate-500 font-bold text-[8px] uppercase tracking-[0.4em] mt-2 max-w-[200px] leading-relaxed text-center">Intelligence First Audit Engine</p>
        </div>

        <div className="w-full bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none animate-in fade-in slide-in-from-bottom-8 duration-700">
          {mode !== 'reset' ? (
            <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <LogIn size={14} /> Enter
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${mode === 'signup' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <UserPlus size={14} /> Create
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className="flex items-center gap-3 mb-10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-600 transition-colors"
            >
              <ChevronLeft size={18} /> Revert to Login
            </button>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {mode === 'login' && 'Authorized Access'}
              {mode === 'signup' && 'Register Asset'}
              {mode === 'reset' && 'Security Reset'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Endpoint Identity</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-600 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@expenseflow.pro"
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            {(mode === 'signup' || mode === 'reset') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Master Key Phrase</label>
                  {mode === 'signup' && (
                    <div className="group relative">
                      <HelpCircle size={14} className="text-slate-300 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-3 w-56 p-4 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl leading-relaxed">
                        Enter a memorable phrase. This is the only way to recover your account without an admin.
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-600 transition-colors">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type="text"
                    required
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    placeholder="e.g. Blue Moon Coffee 1989"
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                {mode === 'reset' ? 'New Secure Token' : 'Secure Token'}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-600 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dark:text-white"
                />
              </div>
              {mode === 'login' && (
                <div className="flex justify-end pr-2">
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(null); }}
                    className="text-[9px] font-black text-brand-600 uppercase tracking-widest hover:underline"
                  >
                    Recover Password
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-4 p-5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-3xl animate-in shake duration-500">
                <AlertCircle size={20} className="shrink-0" />
                <span className="text-[11px] font-black uppercase leading-tight">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl animate-in zoom-in duration-300">
                <ShieldCheck size={20} className="shrink-0" />
                <span className="text-[11px] font-black uppercase leading-tight">{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Verifying...
                </>
              ) : (
                <>
                  <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                  {mode === 'login' ? 'Initiate Session' : mode === 'signup' ? 'Finalize Account' : 'Commit Change'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-loose">
            Enterprise grade security enabled.<br />
            <span className="text-brand-600 cursor-pointer">View Network Protocol</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;