
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InvitationCode } from './types';
import { storageService, DAILY_LIMIT, POST_DAILY_LIMIT } from './services/storageService';
import { CodeCard } from './components/CodeCard';

const App: React.FC = () => {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Load initial data from API
  const loadData = async () => {
    const [fetchedCodes, stats] = await Promise.all([
      storageService.getCodes(),
      storageService.getUserStats()
    ]);
    setCodes(fetchedCodes);
    setTodayCount(stats.todayClaimCount);
  };

  useEffect(() => {
    // Initial load
    loadData().then(() => {
      // Only scroll on very first load
      if (isFirstLoad.current) {
        scrollToBottom();
        isFirstLoad.current = false;
      }
    });

    // Poll every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanValue = inputValue.trim();
    if (!cleanValue) return;

    // 1. Length Check
    if (cleanValue.length > 50) {
      showError("内容过长，请限制在50字符以内");
      return;
    }

    // 2. Format Validation
    const codeRegex = /[A-Z]{2}\d{4}\s[a-zA-Z0-9]+:\/[A-Z0-9]+/;
    const match = cleanValue.match(codeRegex);
    
    if (!match) {
      showError("格式不正确，需包含如 UA1710 3s:/ERHRG... 的口令");
      return;
    }

    setIsSubmitting(true);

    // 3. API Call
    const result = await storageService.saveCode(cleanValue);
    
    setIsSubmitting(false);

    if (result.success && result.code) {
      // Optimistic update
      setCodes(prev => [...prev, result.code!]);
      setInputValue('');
      setError(null);
      // UX Improvement: Only auto-scroll when *I* post
      scrollToBottom();
    } else {
      showError(result.error || "发布失败");
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleUseCode = async (id: string) => {
    const result = await storageService.useCode(id);
    
    if (result.success && result.code) {
      const updated = result.code;
      const stats = await storageService.getUserStats();
      setTodayCount(stats.todayClaimCount);

      setCodes(prev => {
        if (updated!.remainingUses === 0) {
           return prev.filter(c => c.id !== id);
        }
        return prev.map(c => c.id === id ? { ...c, ...updated } : c);
      });
      return true;
    } else {
      if (result.error) showError(result.error);
      return false;
    }
  };

  const getBeijingDateString = () => {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const beijingTime = new Date(utc + (3600000 * 8));
    return `${beijingTime.getMonth() + 1}月${beijingTime.getDate()}日`;
  };

  const todayDateStr = getBeijingDateString();

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <header className="px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10 shadow-sm text-slate-900">
        <div className="relative flex items-center justify-between h-8">
          <button className="flex items-center justify-center w-8 h-8 -ml-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-transform">
            <i className="fas fa-chevron-left text-lg"></i>
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline gap-1">
             <span className="font-bold text-[15px]">元宝红包口令贴吧</span>
             <span className="text-xs text-slate-500 font-medium">[{todayDateStr}]</span>
          </div>

          <div className="flex items-center text-xs text-slate-500 font-medium">
            已领 <span className={`ml-1 font-bold text-sm ${todayCount >= DAILY_LIMIT ? 'text-red-500' : 'text-slate-800'}`}>
              {todayCount}
            </span><span className="text-slate-400">/{DAILY_LIMIT}</span>
          </div>
        </div>
      </header>

      {/* Code Stream */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-2 scroll-smooth"
      >
        {codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <p className="font-medium">暂无有效红包码</p>
            <p className="text-xs mt-1">分享你的口令，大家一起领</p>
          </div>
        ) : (
          <>
            {codes.map((code) => (
              <CodeCard 
                key={code.id} 
                code={code} 
                onUse={() => handleUseCode(code.id)}
                alreadyUsed={code.alreadyUsed}
                isOwnCode={code.isOwnCode}
              />
            ))}
            <div className="h-4 w-full" />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 bg-white border-t border-slate-100 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.05)] relative z-20">
        {error && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[11px] px-4 py-2 rounded-xl shadow-2xl animate-bounce backdrop-blur-sm whitespace-nowrap">
            <i className="fas fa-exclamation-circle mr-2 text-red-400"></i>
            {error}
          </div>
        )}
        <form onSubmit={handlePost} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="粘贴元宝口令"
            disabled={isSubmitting}
            className={`w-full pl-4 pr-24 py-4 bg-slate-50 border rounded-2xl focus:outline-none focus:ring-4 transition-all text-sm font-medium ${
              error ? 'border-red-400 focus:ring-red-500/10' : 'border-slate-200 focus:ring-red-500/10 focus:border-red-500'
            }`}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSubmitting}
            className="absolute right-2 top-2 bottom-2 px-6 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            发布
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
