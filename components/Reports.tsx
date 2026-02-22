
import React, { useState, useEffect } from 'react';
import { 
  History, 
  Calendar, 
  ChevronDown, 
  CheckCircle2, 
  Loader2, 
  Cloud, 
  Database, 
  ArrowDownToLine, 
  AlertTriangle, 
  FileQuestion, 
  ShieldCheck, 
  Target, 
  Search,
  Receipt,
  Mail,
  Send,
  CreditCard,
  FileText,
  Info
} from 'lucide-react';
import { ReconciliationReport, Expense } from '../types';
import { getReconciliations } from '../backendService';

interface ReportsProps {
  period: { month: string; year: number };
}

const Reports: React.FC<ReportsProps> = ({ period }) => {
  const [reports, setReports] = useState<(ReconciliationReport & { is_local?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(period.year);

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  useEffect(() => { setSelectedYear(period.year); }, [period.year]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getReconciliations(selectedYear);
      setReports(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = (report: ReconciliationReport) => {
    const headers = ['Type', 'Date', 'Merchant', 'Category', 'Amount', 'Currency', 'Audit_Status'];
    const rows = [
      ...(report.matched_transactions || []).map(t => ['MATCHED', t.date, t.merchant, t.category, t.amount.toString(), t.currency, 'Verified']),
      ...(report.mandatory_missing || []).map(t => ['MANDATORY_MISSING', t.date, t.merchant, t.category, t.amount.toString(), t.currency, 'High Priority Violation']),
      ...(report.standard_missing || []).map(t => ['GENERAL_MISSING', t.date, t.merchant, t.category, t.amount.toString(), t.currency, 'Pending Receipt']),
      ...(report.optional_missing || []).map(t => ['OPTIONAL_MISSING', t.date, t.merchant, t.category, t.amount.toString(), t.currency, 'Threshold Exempt'])
    ];
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Audit_Snapshot_${report.month}_${report.year}.csv`;
    link.click();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-pulse">
      <Loader2 className="text-brand-600 animate-spin" size={48} />
      <p className="text-slate-500 dark:text-slate-400 mt-6 font-black uppercase text-[10px] tracking-[0.3em]">Accessing Data Vault...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h3 className="text-2xl font-black tracking-tighter uppercase">Audit Snapshot Archive</h3>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Immutable Compliance Record Storage</p>
        </div>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-2xl text-[11px] font-black text-slate-700 dark:text-slate-300 outline-none shadow-sm uppercase tracking-widest">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {reports.length === 0 ? (
        <div className="max-w-3xl mx-auto py-32 text-center bg-white dark:bg-slate-900/50 rounded-[3.5rem] border border-dashed border-slate-200 dark:border-slate-800/60">
          <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-700 shadow-inner"><History size={48} /></div>
          <h3 className="text-2xl font-black tracking-tighter uppercase">No Filed Snapshots</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Complete a compliance audit and use 'File Period Audit' to save permanent records.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {reports.map(report => {
            const isExpanded = expandedReportId === report.id;
            const score = report.summary?.compliance_score || 0;
            return (
              <div key={report.id} className={`bg-white dark:bg-[#0b1120] transition-all duration-500 overflow-hidden ${isExpanded ? 'border-brand-500 ring-[16px] ring-brand-500/5 rounded-[4rem] shadow-2xl mb-16' : 'border border-slate-100 dark:border-slate-800/60 rounded-[3rem] mb-6 hover:border-brand-300 shadow-sm'}`}>
                <div className="p-10 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-8" onClick={() => setExpandedReportId(isExpanded ? null : report.id || null)}>
                  <div className="flex items-center gap-8">
                    <div className={`p-6 rounded-[2rem] shadow-sm transition-all ${isExpanded ? 'bg-brand-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-300'}`}>
                        <Calendar size={36} />
                    </div>
                    <div>
                      <div className="flex items-center gap-4">
                        <h4 className="text-4xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">{report.month} {report.year}</h4>
                        <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border bg-brand-50 dark:bg-brand-900/40 text-brand-700 border-brand-100 dark:border-brand-500/20">
                          <Cloud size={10} /> Cloud Sync
                        </span>
                      </div>
                      <div className="flex items-center gap-5 mt-4">
                        <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"><CheckCircle2 size={14} /> {report.summary?.total_matched || 0} Matched</span>
                        <div className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                        <span className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest"><AlertTriangle size={14} /> {report.summary?.mandatory_error_count || 0} High Gaps</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] mb-1">Compliance Integrity</div>
                      <div className={`text-6xl font-black tracking-tighter ${score > 90 ? 'text-emerald-500' : score > 70 ? 'text-amber-500' : 'text-red-500'}`}>{score}%</div>
                    </div>
                    <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 transition-all ${isExpanded ? 'rotate-180 bg-brand-50 text-brand-600' : ''}`}>
                      <ChevronDown size={24} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-12 pb-14 pt-2 bg-slate-50/20 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/60">
                    {/* The 4-Card Breakdown within the expansion */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 my-12">
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-emerald-500 font-black text-5xl tracking-tighter mb-1">{report.summary?.total_matched || 0}</div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verified</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-blue-500 font-black text-5xl tracking-tighter mb-1">{report.summary?.optional_count || 0}</div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Optional</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-amber-500 font-black text-5xl tracking-tighter mb-1">{report.summary?.warning_count || 0}</div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">General</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-red-500 font-black text-5xl tracking-tighter mb-1">{report.summary?.mandatory_error_count || 0}</div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Hard Gaps</div>
                      </div>
                    </div>

                    <div className="space-y-12">
                      <section className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
                        <div className="px-10 py-6 bg-emerald-600 text-white">
                          <h4 className="text-[12px] font-black uppercase tracking-[0.2em]">Verified Ledger (Snapshot)</h4>
                        </div>
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {(report.matched_transactions || []).map((exp, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                <td className="px-10 py-8">
                                  <div className="font-black text-slate-900 dark:text-white uppercase text-[12px] tracking-tight">{exp.merchant}</div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{exp.date} • {exp.category}</div>
                                </td>
                                <td className="px-10 py-8 text-center">
                                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20">
                                    PROOF VERIFIED
                                  </span>
                                </td>
                                <td className="px-10 py-8 text-right font-black text-slate-900 dark:text-white uppercase text-sm">
                                  {exp.currency} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>

                      {report.mandatory_missing?.length > 0 && (
                        <section className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-red-100 dark:border-red-900/40 overflow-hidden">
                          <div className="px-10 py-6 bg-red-600 text-white">
                            <h4 className="text-[12px] font-black uppercase tracking-[0.2em]">Mandatory Proof Required</h4>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {report.mandatory_missing.map(exp => (
                              <div key={exp.id} className="px-10 py-8 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                  <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600"><Target size={20} /></div>
                                  <div>
                                    <div className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{exp.merchant}</div>
                                    <div className="text-[10px] text-red-600 font-bold uppercase mt-1">{exp.category} • {exp.date}</div>
                                  </div>
                                </div>
                                <div className="text-right text-sm font-black text-red-700 dark:text-red-400 uppercase">{exp.currency} {exp.amount.toFixed(2)}</div>
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
        </div>
      )}
    </div>
  );
};

export default Reports;
