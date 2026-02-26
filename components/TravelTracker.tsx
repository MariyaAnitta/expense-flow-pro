
import React, { useMemo, useState, useEffect } from 'react';
import { TravelLog, Expense } from '../types';
import { isHomeLocation } from '../firebaseService';
import { getExchangeRates, convertToINR, ExchangeRates } from '../currencyService';
import {
  Plane,
  MapPin,
  Calendar,
  Hotel,
  Globe,
  Award,
  ShieldCheck,
  ShieldAlert,
  History,
  Info,
  ChevronRight,
  TrendingUp,
  Map,
  ArrowRightLeft
} from 'lucide-react';

interface TravelTrackerProps {
  logs: TravelLog[];
  expenses: Expense[];
  period: { month: string; year: number };
}

type JurisdictionSegment = {
  id: string;
  country: string;
  city: string;
  days: number;
  startDate: string;
  endDate: string;
  flight: TravelLog | null;
  hotel: TravelLog | null;
  status: 'verified' | 'action_required';
  provider: string;
};

const TravelTracker: React.FC<TravelTrackerProps> = ({ logs, expenses, period }) => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'action_required'>('all');
  const [exchangeData, setExchangeData] = useState<ExchangeRates | null>(null);
  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    getExchangeRates().then(setExchangeData);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const date = new Date(log.start_date);
      const logYear = date.getFullYear();
      const logMonth = monthsList[date.getMonth()];
      const matchesPeriod = logYear === period.year && (period.month === "All Months" || logMonth === period.month);
      return matchesPeriod;
    });
  }, [logs, period]);

  // FORENSIC MATCHING ENGINE: Shared with Dashboard
  const verifyStay = (log: TravelLog | null): boolean => {
    if (!log || !exchangeData) return false;
    if (log.hotel_verification_status === 'verified') return true;

    const rates = exchangeData.rates || {};
    const anchors = expenses.filter(e => {
      const src = String(e.source || '').toLowerCase().trim();
      return src === 'bank_statement' || src === 'credit_card_statement';
    });

    // Check for a financial match in the bank statement pool
    // We allow matching against ANY bank record, even in the next month.
    return anchors.some(bankTx => {
      const bDate = new Date(bankTx.date).getTime();
      const lDate = new Date(log.start_date).getTime();

      // Amount / Sub-Category check is only reliable for hotels
      if (log.travel_type !== 'accommodation') return false;

      // 1. Window Parity (14 days for hotels)
      const diffDays = Math.abs(bDate - lDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) return false;

      // 2. Merchant Parity
      const bMerc = bankTx.merchant.toLowerCase();
      const lProv = log.provider_name.toLowerCase();
      const mercMatch = lProv.includes(bMerc.substring(0, 4)) || bMerc.includes(lProv.substring(0, 4));
      if (!mercMatch) return false;

      // 3. Amount Parity (Handle currency conversion)
      // Note: We don't have the amount on the TravelLog object here, 
      // but if the merchant and date match closely, and we see an expense 
      // for this stay in the proofs, it's strong enough.
      // However, we want to match BANK -> HOTEL. 
      // We'll search for a "Proof" expense that matches this hotel first.
      const proofs = expenses.filter(e => e.source !== 'bank_statement' && e.source !== 'credit_card_statement');
      const docMatch = proofs.find(p => p.merchant.toLowerCase().includes(lProv.substring(0, 4)) || lProv.includes(p.merchant.toLowerCase().substring(0, 4)));

      if (docMatch) {
        const bINR = convertToINR(bankTx.amount, bankTx.currency, rates);
        const pINR = convertToINR(docMatch.amount, docMatch.currency, rates);
        const sameCurrency = bankTx.currency === docMatch.currency;
        return sameCurrency ? Math.abs(bankTx.amount - docMatch.amount) < 0.10 : Math.abs(bINR - pINR) < (bINR * 0.05);
      }

      return false;
    });
  };

  // CORE LOGIC: Group logs into Jurisdiction Segments (Trips)
  const segments = useMemo(() => {
    const flightLogs = filteredLogs.filter(l => l.travel_type === 'flight' && !l.outbound_flight_id);
    const hotelLogs = filteredLogs.filter(l => l.travel_type === 'accommodation');

    const result: JurisdictionSegment[] = [];
    const usedHotelDocIds = new Set<string>();

    // 1. Process Flights as primary anchors
    flightLogs.forEach(flight => {
      const linkedHotel = hotelLogs.find(h =>
        h.document_id === flight.linked_hotel_id ||
        (new Date(h.start_date) >= new Date(flight.departure_date || flight.start_date) &&
          new Date(h.start_date) <= new Date(flight.return_date || flight.end_date || flight.start_date))
      );

      if (linkedHotel?.document_id) usedHotelDocIds.add(linkedHotel.document_id);

      const isVerified = verifyStay(linkedHotel || null);

      result.push({
        id: flight.id,
        country: flight.destination_country || "Unknown",
        city: flight.destination_city || "Various",
        days: flight.days_spent || 1,
        startDate: flight.departure_date || flight.start_date,
        endDate: flight.return_date || flight.end_date || flight.start_date,
        flight: flight,
        hotel: linkedHotel || null,
        status: isVerified ? 'verified' : 'action_required',
        provider: flight.provider_name
      });
    });

    // 2. Process Standalone Hotels (Stationary Anchors)
    hotelLogs.filter(h => h.document_id && !usedHotelDocIds.has(h.document_id)).forEach(hotel => {
      const isVerified = verifyStay(hotel);
      result.push({
        id: hotel.id,
        country: hotel.destination_country || "International",
        city: hotel.destination_city || "Stay",
        days: hotel.days_spent || 1,
        startDate: hotel.start_date,
        endDate: hotel.end_date || hotel.start_date,
        flight: null,
        hotel: hotel,
        status: isVerified ? 'verified' : 'action_required',
        provider: hotel.provider_name
      });
    });

    return result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [filteredLogs, expenses, exchangeData]);

  const auditStats = useMemo(() => {
    const total = segments.length;
    if (total === 0) return { score: 0, days: 0 };
    const verified = segments.filter(s => s.status === 'verified').length;
    const totalDays = segments.reduce((acc, s) => acc + s.days, 0);
    return {
      score: Math.round((verified / total) * 100),
      days: totalDays,
      count: total
    };
  }, [segments]);

  const displayedSegments = segments.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-48 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[3rem] flex items-center justify-center text-slate-300 dark:text-slate-700 mb-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <Globe size={44} strokeWidth={1} />
        </div>
        <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-800 dark:text-white">No Global Footprint</h3>
        <p className="text-slate-500 mt-2 max-w-sm font-medium text-sm">Upload flight confirmations or hotel invoices to build your jurisdiction audit trail.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Stats Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-6 px-10">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Globe size={24} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Presence</p>
              <h4 className="text-2xl font-black tracking-tighter dark:text-white">{auditStats.days} <span className="text-xs opacity-50 uppercase">Days Abroad</span></h4>
            </div>
          </div>
          <div className="w-px h-10 bg-slate-100 dark:bg-slate-800 hidden md:block"></div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Audit Score</p>
              <h4 className="text-2xl font-black tracking-tighter text-emerald-500">{auditStats.score}% <span className="text-xs opacity-50 uppercase">Verified</span></h4>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            All Stays
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'verified' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Verified
          </button>
          <button
            onClick={() => setFilter('action_required')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'action_required' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Action Required
          </button>
        </div>
      </div>

      {/* Jurisdiction Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {displayedSegments.map(segment => (
          <div key={segment.id} className="group bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden hover:shadow-2xl hover:border-brand-200 dark:hover:border-brand-500/30 transition-all duration-500">
            {/* Card Header */}
            <div className="p-10 pb-6 relative">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-100 dark:border-orange-500/20 shadow-sm group-hover:scale-110 transition-transform duration-500">
                    <MapPin size={28} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter dark:text-white uppercase">{segment.country}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{segment.city}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{segment.days}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Captured Days</div>
                </div>
              </div>

              {/* Timeline Info */}
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] mb-8">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrive</p>
                  <p className="text-xs font-black dark:text-white">{segment.startDate}</p>
                </div>
                <div className="flex-1 px-4 flex items-center justify-center opacity-20">
                  <div className="w-full h-px bg-slate-400 border-t border-dashed"></div>
                  <ChevronRight size={14} className="-ml-1" />
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Depart</p>
                  <p className="text-xs font-black dark:text-white">{segment.endDate}</p>
                </div>
              </div>

              {/* Proof Components */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${segment.flight ? 'bg-sky-50 text-sky-500' : 'bg-slate-50 text-slate-300'} dark:bg-slate-800`}>
                      <Plane size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Movement Proof</p>
                      <p className="text-[10px] font-bold dark:text-slate-300">{segment.flight ? segment.flight.provider_name : "No travel doc found"}</p>
                    </div>
                  </div>
                  {segment.flight && <ShieldCheck size={16} className="text-emerald-500" />}
                  {!segment.flight && <Info size={16} className="text-slate-300" />}
                </div>

                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${segment.hotel ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-300'} dark:bg-slate-800`}>
                      <Hotel size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stay Proof</p>
                      <p className="text-[10px] font-bold dark:text-slate-300">{segment.hotel ? segment.hotel.provider_name : "Missing stay invoice"}</p>
                    </div>
                  </div>
                  {segment.status === 'verified' && <ShieldCheck size={16} className="text-emerald-500" />}
                  {segment.status !== 'verified' && <ShieldAlert size={16} className="text-orange-500" />}
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className={`px-10 py-5 transition-all duration-500 flex items-center justify-between ${segment.status === 'verified'
              ? 'bg-emerald-500 text-white shadow-[0_-10px_20px_-5px_rgba(16,185,129,0.2)]'
              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-400 border-t border-slate-100 dark:border-slate-800'
              }`}>
              <div className="flex items-center gap-3">
                {segment.status === 'verified' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} className="text-orange-500" />}
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {segment.status === 'verified' ? "Audit Verified" : "Action Required"}
                </span>
              </div>
              {segment.status === 'verified' && (
                <span className="text-[9px] font-black opacity-80 uppercase tracking-widest">Matched to Bank</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Auditor's Guide Footer */}
      <div className="bg-white dark:bg-[#0b1120] rounded-[3.5rem] border border-slate-100 dark:border-slate-800 p-12 shadow-xl">
        <div className="flex items-center gap-5 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600">
            <History size={24} />
          </div>
          <div>
            <h4 className="text-xl font-black tracking-tighter dark:text-white uppercase">Auditor's Guide</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">How we verify your presence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-brand-600">
              <Plane size={20} />
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em]">1. Movement</h5>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Flights establish your **Jurisdiction Entry & Exit**. They are the primary anchors for your travel dates.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-500">
              <Hotel size={20} />
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em]">2. Presence</h5>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Hotel invoices provide **Stationary Proof**. They verify you were physically present in the country during those dates.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sky-500">
              <ShieldCheck size={20} />
              <h5 className="text-[11px] font-black uppercase tracking-[0.2em]">3. Verification</h5>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              A stay is **Audit Verified** only when the hotel invoice is matched to a corresponding payment on your **Bank Statement**.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelTracker;
