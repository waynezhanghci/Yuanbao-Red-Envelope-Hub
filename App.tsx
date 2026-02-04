
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InvitationCode } from './types';
import { storageService, DAILY_LIMIT, POST_DAILY_LIMIT } from './services/storageService';
import { CodeCard } from './components/CodeCard';

const App: React.FC = () => {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastPostTime, setLastPostTime] = useState<number>(0);
  const [todayCount, setTodayCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    const loadedCodes = storageService.getCodes();
    setCodes(loadedCodes.filter(c => c.remainingUses > 0));
    setTodayCount(storageService.getTodayCopyCount());
  }, []);

  // Auto-scroll logic
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [codes, scrollToBottom]);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanValue = inputValue.trim();
    
    if (!cleanValue) return;

    // 1. Strict Format Validation (Yuanbao Regex)
    const formatRegex = /^[A-Z]{2}\d{4}\s[a-zA-Z0-9]+:\/[A-Z0-9]+$/;
    
    if (!formatRegex.test(cleanValue)) {
      showError("格式不正确，示例: UA1710 3s:/ERHRGGNDM3");
      return;
    }

    // 2. Daily Post Limit Check
    const todayPostCount = storageService.getTodayPostCount();
    if (todayPostCount >= POST_DAILY_LIMIT) {
      showError(`发布失败：每日最多发布 ${POST_DAILY_LIMIT} 条邀请码`);
      return;
    }

    // 3. Rate Limiting (10 second cooldown)
    const now = Date.now();
    if (now - lastPostTime < 10000) {
      const remaining = Math.ceil((10000 - (now - lastPostTime)) / 1000);
      showError(`发布太快了，请等待 ${remaining} 秒`);
      return;
    }

    // 4. Duplicate Detection
    const isDuplicate = codes.some(c => c.content === cleanValue);
    if (isDuplicate) {
      showError("该邀请码已在列表中");
      return;
    }

    const result = storageService.saveCode(cleanValue);
    if (result.success && result.code) {
      setCodes(prev => [...prev, result.code!]);
      setInputValue('');
      setLastPostTime(now);
      setError(null);
    } else {
      showError(result.error || "发布失败");
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleUseCode = (id: string) => {
    const result = storageService.useCode(id);
    
    if (result.success && result.code) {
      const updated = result.code;
      setTodayCount(storageService.getTodayCopyCount());
      if (updated.remainingUses === 0) {
        setCodes(prev => prev.filter(c => c.id !== id));
      } else {
        setCodes(prev => prev.map(c => c.id === id ? updated : c));
      }
      return true;
    } else {
      if (result.error) showError(result.error);
      return false;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <header className="p-6 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* APP Icon - Gray background + Red Envelope Emoji */}
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-slate-200 select-none">
              🧧
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">元宝红包邀请码</h1>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                复制口令到元宝抢红包
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">今日已领</span>
            <span className={`text-xl font-black ${todayCount >= DAILY_LIMIT ? 'text-red-500' : 'text-slate-700'}`}>
              {todayCount}<span className="text-xs text-slate-300 font-normal ml-0.5">/ {DAILY_LIMIT}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Code Stream */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-2 scroll-smooth"
      >
        {codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            {/* Removed empty state image */}
            <p className="font-medium">暂无有效红包码</p>
            <p className="text-xs">分享你的口令，大家一起领</p>
          </div>
        ) : (
          <>
            {/* Removed the "Real-time red envelope stream" badge as requested (middle picture/graphic) */}
            
            {codes.map((code) => (
              <CodeCard 
                key={code.id} 
                code={code} 
                onUse={() => handleUseCode(code.id)}
                alreadyUsed={storageService.hasUserCopiedCode(code.id)}
                isOwnCode={storageService.isOwnCode(code.id)}
              />
            ))}
            
            <div className="h-4 w-full" />
          </>
        )}
      </main>

      {/* Footer & Publisher */}
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
            placeholder="输入口令 (格式: UA1710 3s:/ERHRG...)"
            className={`w-full pl-4 pr-24 py-4 bg-slate-50 border rounded-2xl focus:outline-none focus:ring-4 transition-all text-sm font-medium ${
              error ? 'border-red-400 focus:ring-red-500/10' : 'border-slate-200 focus:ring-red-500/10 focus:border-red-500'
            }`}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
          >
            <i className="fas fa-paper-plane"></i>
            发布
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
