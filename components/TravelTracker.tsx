
import React, { useMemo } from 'react';
import { TravelLog } from '../types';
import { isHomeLocation } from '../firebaseService';
import {
  Plane,
  MapPin,
  Calendar,
  Clock,
  Hotel,
  Globe,
  ChevronRight,
  TrendingUp,
  Award,
  Navigation,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRightLeft,
  Home,
  ShieldCheck,
  ShieldAlert,
  User
} from 'lucide-react';

interface TravelTrackerProps {
  logs: TravelLog[];
  period: { month: string; year: number };
}

const TravelTracker: React.FC<TravelTrackerProps> = ({ logs, period }) => {
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const date = new Date(log.start_date);
      const logYear = date.getFullYear();
      const logMonth = monthsList[date.getMonth()];
      const matchesPeriod = logYear === period.year && (period.month === "All Months" || logMonth === period.month);
      return matchesPeriod;
    });
  }, [logs, period]);

  const confirmedLogs = useMemo(() => filteredLogs.filter(l => l.status === 'Complete' && l.travel_type === 'flight'), [filteredLogs]);
  const accommodationLogs = useMemo(() => filteredLogs.filter(l => l.travel_type === 'accommodation'), [filteredLogs]);

  const countryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    confirmedLogs.filter(l => !isHomeLocation(l)).forEach(log => {
      const country = log.destination_country || "International";
      stats[country] = (stats[country] || 0) + log.days_spent;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [confirmedLogs]);

  const daysAbroad = useMemo(() => {
    return confirmedLogs.reduce((acc, curr) => {
      return !isHomeLocation(curr) ? acc + curr.days_spent : acc;
    }, 0);
  }, [confirmedLogs]);

  const totalDaysInPeriod = useMemo(() => {
    if (period.month === "All Months") return 365;
    const monthIndex = monthsList.indexOf(period.month);
    return new Date(period.year, monthIndex + 1, 0).getDate();
  }, [period, period.year, period.month]);

  const daysAtHome = Math.max(0, totalDaysInPeriod - daysAbroad);

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'Complete') {
      return (
        <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
          <CheckCircle2 size={12} /> COMPLETE
        </span>
      );
    }
    if (status === 'Open - Awaiting return') {
      return (
        <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/20">
          <Loader2 size={12} className="animate-spin" /> RETURN PENDING
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-600 text-white shadow-lg shadow-orange-600/20">
        <AlertTriangle size={12} /> OUTBOUND MISSING
      </span>
    );
  };

  const HotelAuditBadge = ({ status, hotelName }: { status?: string, hotelName?: string }) => {
    if (status === 'verified') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Hotel Verified: {hotelName || 'Document Linked'}</span>
        </div>
      );
    }
    if (status === 'missing') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400">
          <ShieldAlert size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Hotel Invoice Missing</span>
        </div>
      );
    }
    return null;
  };

  if (filteredLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-48 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-slate-300 dark:text-slate-700 mb-8">
          <Globe size={48} strokeWidth={1} />
        </div>
        <h3 className="text-2xl font-black tracking-tighter uppercase">No Global Presence</h3>
        <p className="text-slate-500 mt-2 max-w-sm font-medium text-sm">Upload flight confirmations or hotel invoices to track your international footprint.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-brand-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-20 group-hover:scale-110 transition-transform duration-700"><Globe size={100} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Confirmed Time Abroad</p>
            <h4 className="text-5xl font-black tracking-tighter">{daysAbroad} <span className="text-lg opacity-60 font-bold uppercase tracking-widest">Days</span></h4>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl"><Award size={16} /></div>
            <p className="text-[10px] font-black uppercase tracking-widest">{countryStats.length} Jurisdictions Visited</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-4 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-600"><Home size={28} /></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Residency Presence</p>
              <h4 className="text-3xl font-black tracking-tighter uppercase">UAE</h4>
            </div>
          </div>
          <div className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            {daysAtHome} Days at Home Base
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-4 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-500"><Plane size={28} /></div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobility Logs</p>
              <h4 className="text-3xl font-black tracking-tighter">{filteredLogs.filter(l => l.travel_type === 'flight').length}</h4>
            </div>
          </div>
          <div className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            Total Flight Segments
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-6">
          <div className="px-4">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Jurisdiction Breakdown</h4>
            <div className="space-y-4">
              {countryStats.length > 0 ? countryStats.map(([country, days]) => (
                <div key={country} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-black text-[10px]">
                      {country.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-black uppercase tracking-tight dark:text-white">{country}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black dark:text-white">{days}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase block tracking-widest">Days</span>
                  </div>
                </div>
              )) : (
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic text-center py-4">All time spent at Home Base.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-12 py-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <History size={20} className="text-brand-500" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em]">Travel Mobility Trail</h4>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs
                .filter(l => l.travel_type === 'flight' && !l.outbound_flight_id && !isHomeLocation(l))
                .map(log => {
                  const isMerged = !!(log.return_flight_id || log.return_date);
                  const hotelStay = accommodationLogs.find(h => h.document_id === log.linked_hotel_id);

                  return (
                    <div key={log.id} className="p-10 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-8">
                        <div className={`p-5 rounded-[2rem] bg-sky-50 text-sky-600 dark:bg-slate-800/50 shadow-sm border border-white dark:border-slate-700`}>
                          <Plane size={32} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h5 className="text-xl font-black tracking-tighter uppercase dark:text-white">
                              {isHomeLocation(log) ? "Dubai (Return Home)" : `${log.destination_city || log.destination_country}`}
                            </h5>
                            <StatusBadge status={log.status} />
                            {isMerged && !isHomeLocation(log) && (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-widest border border-indigo-200">
                                <ArrowRightLeft size={8} className="inline mr-1" /> Bridged Segment
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                            <span className="flex items-center gap-2">
                              <Calendar size={14} className="opacity-50" />
                              <span>{log.departure_date || log.start_date}</span>
                              {log.return_date && (
                                <>
                                  <span className="opacity-30">→</span>
                                  <span>{log.return_date}</span>
                                </>
                              )}
                            </span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                            <span className="flex items-center gap-2"><MapPin size={14} className="opacity-50" /> {log.provider_name}</span>
                          </div>

                          <div className="flex flex-col gap-2">
                            <HotelAuditBadge status={log.hotel_verification_status} hotelName={hotelStay?.provider_name} />
                            {hotelStay && (
                              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                <User size={12} /> Registered Guest: {hotelStay.guest_name || 'Not Extracted'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black dark:text-white tracking-tighter">
                          {log.days_spent}
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          {log.days_spent === 1 ? 'Captured Day' : 'Captured Days'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelTracker;
