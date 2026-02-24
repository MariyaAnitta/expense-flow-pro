
import React, { useState } from 'react';
import {
  UploadCloud,
  Loader2,
  Sparkles,
  CheckCircle2,
  FileText,
  PlusCircle,
  ShieldCheck,
  Zap,
  Cpu,
  ArrowRight,
  Database,
  Scan,
  Mail,
  X,
  CreditCard,
  Clock,
  AlertCircle
} from 'lucide-react';
import { extractAllData, batchExtractAllData } from '../geminiService';
import { Expense, ExpenseSource, TravelLog } from '../types';

interface ExtractorProps {
  onExtract: (data: { expenses: Expense[], travelLogs: TravelLog[] }) => void;
}

interface FilePreview {
  id: string;
  name: string;
  type: string;
  data: string;
  rawFile: File;
  isEmail: boolean;
  isCsv: boolean;
  rowCount?: number;
  sizeLabel: string;
}

const MAX_IMAGE_WIDTH = 800; // Reduced from 1024 for tighter token optimization

const Extractor: React.FC<ExtractorProps> = ({ onExtract }) => {
  const [activeMode, setActiveMode] = useState<ExpenseSource>('receipt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('Amex');
  const [successCount, setSuccessCount] = useState<{ expenses: number, travel: number } | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    return (kb / 1024).toFixed(1) + ' MB';
  };

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > MAX_IMAGE_WIDTH) {
          height *= MAX_IMAGE_WIDTH / width;
          width = MAX_IMAGE_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = base64;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    setSuccessCount(null);

    selectedFiles.forEach(file => {
      const isEmail = file.name.endsWith('.eml') || file.name.endsWith('.msg') || file.type === 'message/rfc822';
      const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv';
      const reader = new FileReader();

      reader.onloadend = async () => {
        let processedData = reader.result as string;
        let rowCount = 0;

        if (file.type.startsWith('image/')) {
          processedData = await compressImage(processedData);
        }

        if (isCsv) {
          rowCount = processedData.split('\n').filter(line => line.trim()).length;
        }

        setPreviews(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            data: processedData,
            rawFile: file,
            isEmail: isEmail,
            isCsv: isCsv,
            rowCount,
            sizeLabel: formatSize(file.size)
          }
        ]);
      };

      if (isEmail || isCsv) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
    e.target.value = '';
  };

  const removePreview = (id: string) => {
    setPreviews(prev => prev.filter(p => p.id !== id));
  };

  const processContent = async () => {
    if (previews.length === 0) return;
    setIsProcessing(true);
    setSuccessCount(null);
    setCurrentFileIndex(0);

    const inputs = previews.map(p => {
      let extractionInput: string | { data: string; mimeType: string };
      if (p.isEmail || p.isCsv) {
        extractionInput = p.data;
      } else {
        const base64Data = p.data.split(',')[1] || '';
        extractionInput = { data: base64Data, mimeType: p.type || 'application/octet-stream' };
      }
      return {
        content: extractionInput,
        source: activeMode === 'receipt' ? 'web_upload' : activeMode
      };
    });

    console.log("Extractor Inputs built:", inputs);

    try {
      const CHUNK_SIZE = 1; // Sequential processing to guarantee 1M token limit per request
      const allExpenses: Expense[] = [];
      const allTravelLogs: TravelLog[] = [];

      for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
        const chunk = inputs.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(inputs.length / CHUNK_SIZE);

        setProcessingStatus(`Processing Batch ${chunkNum}/${totalChunks} (${chunk.length} documents)...`);
        setCurrentFileIndex(i);

        if (i > 0) {
          setProcessingStatus('Cooling down for next document set...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const res = await batchExtractAllData(chunk, selectedBank);
        allExpenses.push(...res.expenses);
        allTravelLogs.push(...res.travelLogs);
      }

      onExtract({ expenses: allExpenses, travelLogs: allTravelLogs });
      setSuccessCount({
        expenses: allExpenses.length,
        travel: allTravelLogs.length
      });

      setTimeout(() => {
        setPreviews([]);
        setCurrentFileIndex(0);
        setProcessingStatus('');
      }, 3000);

    } catch (e: any) {
      console.error("Extraction error:", e);
      const isRateLimit = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED');
      alert(isRateLimit ? "AI Quota limit reached despite retries. Please wait 60 seconds." : "Batch extraction failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const ModeCard = ({ mode, icon: Icon, label, desc, colorClass }: { mode: ExpenseSource, icon: any, label: string, desc: string, colorClass: string }) => (
    <button
      onClick={() => { setActiveMode(mode); setPreviews([]); setSuccessCount(null); }}
      className={`flex-1 text-left p-8 rounded-[2.5rem] border-2 transition-all duration-500 relative overflow-hidden group ${activeMode === mode
        ? `bg-white dark:bg-slate-900 ${colorClass} shadow-2xl scale-105 z-10`
        : 'bg-white/50 dark:bg-slate-900/30 border-transparent hover:border-slate-200 dark:hover:border-slate-800'
        }`}
    >
      <div className={`p-4 rounded-2xl w-fit mb-6 shadow-sm border ${activeMode === mode ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400'
        }`}>
        <Icon size={24} className={activeMode === mode ? '' : 'opacity-40'} />
      </div>
      <h4 className={`text-sm font-black uppercase tracking-widest ${activeMode === mode ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
        {label}
      </h4>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2 group-hover:opacity-100 opacity-60 transition-opacity">
        {desc}
      </p>
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col md:flex-row gap-6">
        <ModeCard mode="receipt" icon={FileText} label="Upload Document" desc="Receipts/Invoices" colorClass="border-emerald-500/50 text-emerald-600" />
        <ModeCard mode="credit_card_statement" icon={CreditCard} label="Card Statement" desc="Bank PDFs/Images" colorClass="border-indigo-500/50 text-indigo-600" />
        <ModeCard mode="bank_statement" icon={Database} label="Bank Ledger" desc="CSV/Exports" colorClass="border-amber-500/50 text-amber-600" />
      </div>

      <div className="bg-white dark:bg-[#0b1120] p-12 rounded-[4rem] shadow-2xl border border-slate-200 dark:border-slate-800/60">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Scan size={28} />
            </div>
          </div>
          <h3 className="text-3xl font-black tracking-tighter uppercase">Intelligent Audit Feed</h3>
          <p className="text-sm text-slate-500 mt-2 font-medium">Extracting financial proof with native AI precision.</p>

          {/* BANK SELECTION BAR */}
          <div className="mt-10 flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Target Account / Bank</p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Amex', 'Citi', 'HSBC', 'Standard Chartered', 'Other'].map(bank => (
                <button
                  key={bank}
                  onClick={() => setSelectedBank(bank)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${selectedBank === bank
                      ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/20 scale-105'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700 hover:border-brand-300'
                    }`}
                >
                  {bank}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`relative border-2 border-dashed rounded-[3rem] p-12 transition-all ${previews.length > 0
          ? 'border-brand-500 bg-brand-50/10'
          : 'border-slate-200 hover:border-brand-500'
          }`}>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.eml,.msg,.csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="flex flex-col items-center text-center relative z-20 pointer-events-none">
            {previews.length > 0 ? (
              <div className="w-full space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {previews.map((p) => (
                    <div key={p.id} className="relative bg-white dark:bg-slate-800 p-4 rounded-[2rem] border border-slate-200 shadow-sm animate-in zoom-in duration-200 pointer-events-auto">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePreview(p.id); }}
                        className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full z-30 shadow-xl border-2 border-white dark:border-slate-900 transition-all hover:scale-110 pointer-events-auto"
                        title="Remove document"
                      >
                        <X size={14} strokeWidth={4} />
                      </button>

                      <div className="h-24 w-full flex items-center justify-center mb-3">
                        {p.type.startsWith('image/') ? (
                          <img src={p.data} alt="Preview" className="h-full w-full object-cover rounded-2xl" />
                        ) : p.isEmail ? (
                          <div className="bg-sky-50 dark:bg-sky-900/40 p-4 rounded-2xl text-sky-500"><Mail size={32} /></div>
                        ) : p.isCsv ? (
                          <div className="bg-amber-50 dark:bg-amber-900/40 p-4 rounded-2xl text-amber-500"><Database size={32} /></div>
                        ) : (
                          <div className="bg-slate-100 p-4 rounded-2xl text-slate-400"><FileText size={32} /></div>
                        )}
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-tight truncate px-1 text-slate-900 dark:text-white" title={p.name}>{p.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.sizeLabel}</p>
                      {p.rowCount !== undefined && p.rowCount > 50 && (
                        <div className="mt-2 text-[8px] font-bold text-amber-600 uppercase flex items-center justify-center gap-1">
                          <AlertCircle size={10} /> Large Ledger ({p.rowCount} rows)
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-2 border-dashed border-slate-200 rounded-[2rem] h-full min-h-[140px] flex flex-col items-center justify-center text-slate-400 hover:border-brand-300 pointer-events-none">
                    <PlusCircle size={24} className="mb-2" />
                    <span className="text-[9px] font-black uppercase">Add More</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-[2.5rem] mb-8 text-slate-400 transition-all"><UploadCloud size={64} strokeWidth={1} /></div>
                <p className="font-black text-2xl tracking-tight dark:text-white">Batch Upload Ready</p>
                <p className="text-slate-400 text-[10px] mt-3 uppercase tracking-[0.2em] font-bold">Supports Receipts, PDFs, CSVs & Email Alerts</p>
              </>
            )}
          </div>
        </div>

        {isProcessing && (
          <div className="mt-8 p-6 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 rounded-[2rem] flex items-center gap-5 text-brand-700 animate-pulse">
            <div className="bg-brand-500 p-3 rounded-2xl text-white shadow-xl"><Clock size={24} /></div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest">{processingStatus}</div>
              <div className="text-[9px] font-bold uppercase opacity-60">Sequence: {currentFileIndex} / {previews.length}</div>
            </div>
          </div>
        )}

        {successCount !== null && (
          <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 rounded-[2rem] flex items-center gap-5 text-emerald-700 animate-in zoom-in duration-300">
            <div className="bg-emerald-500 p-3 rounded-2xl text-white shadow-xl"><CheckCircle2 size={24} /></div>
            <div className="text-xs font-black uppercase tracking-widest">{successCount.expenses} Entries successfully ingested</div>
          </div>
        )}

        <div className="mt-12">
          <button
            onClick={processContent}
            disabled={isProcessing || previews.length === 0}
            className="w-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] transition-all disabled:opacity-50 flex items-center justify-center gap-5 shadow-2xl active:scale-[0.98]"
          >
            {isProcessing ? <><Loader2 className="animate-spin" size={28} /> Ingesting Data...</> : <><Sparkles size={28} /> Start Batch Extraction <ArrowRight size={28} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Extractor;
