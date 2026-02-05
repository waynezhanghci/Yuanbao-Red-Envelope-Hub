
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InvitationCode } from './types';
import { storageService, DAILY_LIMIT, POST_DAILY_LIMIT } from './services/storageService';
import { CodeCard } from './components/CodeCard';

// Simulated User IDs
const USERS = {
  HOST: 'user_host_001',
  GUEST: 'user_guest_001'
};

const App: React.FC = () => {
  // State for simulated user identity
  const [currentUser, setCurrentUser] = useState<string>(USERS.GUEST); // Default to Guest
  const [isSwitching, setIsSwitching] = useState(false);

  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load data based on current user
  const loadData = useCallback(() => {
    const loadedCodes = storageService.getCodes();
    // Filter out 0 uses codes for display cleanliness, or keep them to show "empty"
    setCodes(loadedCodes.filter(c => c.remainingUses > 0));
    setTodayCount(storageService.getTodayCopyCount(currentUser));
  }, [currentUser]);

  // Initial load and reload when user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle User Switch
  const toggleUser = () => {
    setIsSwitching(true);
    // Add a small delay to simulate context switch visual
    setTimeout(() => {
      const newUser = currentUser === USERS.HOST ? USERS.GUEST : USERS.HOST;
      setCurrentUser(newUser);
      setIsSwitching(false);
      // Auto scroll to bottom when switching to see latest content context
      setTimeout(scrollToBottom, 100);
    }, 300);
  };

  // Auto-scroll logic
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  // Scroll only on initial load or new code added (not on every user switch unless intentional)
  useEffect(() => {
    if (!isSwitching) {
       scrollToBottom();
    }
  }, [codes.length, scrollToBottom, isSwitching]);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
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

    const extractedCode = match[0];

    // 3. Daily Post Limit Check
    const todayPostCount = storageService.getTodayPostCount(currentUser);
    if (todayPostCount >= POST_DAILY_LIMIT) {
      showError(`发布失败：每日最多发布 ${POST_DAILY_LIMIT} 条邀请码`);
      return;
    }

    // 4. Duplicate Detection
    const isDuplicate = codes.some(c => {
      const existingMatch = c.content.match(codeRegex);
      return existingMatch && existingMatch[0] === extractedCode;
    });

    if (isDuplicate) {
      showError("该邀请码已在列表中");
      return;
    }

    const result = storageService.saveCode(cleanValue, currentUser);
    if (result.success && result.code) {
      setCodes(prev => [...prev, result.code!]);
      setInputValue('');
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
    const result = storageService.useCode(id, currentUser);
    
    if (result.success && result.code) {
      const updated = result.code;
      setTodayCount(storageService.getTodayCopyCount(currentUser));
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

  const getBeijingDateString = () => {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const beijingTime = new Date(utc + (3600000 * 8));
    return `${beijingTime.getMonth() + 1}月${beijingTime.getDate()}日`;
  };

  const todayDateStr = getBeijingDateString();
  const isHost = currentUser === USERS.HOST;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x border-slate-200 bg-white shadow-2xl relative">
      
      {/* Switch Overlay Transition */}
      {isSwitching && (
        <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold animate-pulse">
            切换身份中...
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10 shadow-sm text-slate-900">
        <div className="relative flex items-center justify-between h-8">
          
          {/* Left: Avatar Switcher */}
          <div className="flex items-center gap-1">
            <button className="flex items-center justify-center w-6 h-8 -ml-2 text-slate-600 hover:text-slate-900 active:scale-95 transition-transform">
              <i className="fas fa-chevron-left text-lg"></i>
            </button>
            
            {/* User Identity Toggle (Compacted) */}
            <button 
              onClick={toggleUser}
              className={`flex items-center gap-1 pl-1 pr-2 py-1 rounded-full text-[10px] font-bold transition-all border ${
                isHost 
                  ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${isHost ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                <i className={`fas ${isHost ? 'fa-user-tie' : 'fa-user'} text-[10px]`}></i>
              </div>
              <span className="whitespace-nowrap">{isHost ? '主态' : '客态'}</span>
            </button>
          </div>

          {/* Center: Title */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline gap-1 pointer-events-none">
             <span className="font-bold text-[15px] whitespace-nowrap">元宝红包口令贴吧</span>
             <span className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline">[{todayDateStr}]</span>
          </div>

          {/* Right: Count */}
          <div className="flex items-center text-xs text-slate-500 font-medium whitespace-nowrap ml-2">
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
            <p className="font-medium">共享元宝红包口令</p>
          </div>
        ) : (
          <>
            {codes.map((code) => (
              <CodeCard 
                key={code.id} 
                code={code} 
                onUse={() => handleUseCode(code.id)}
                alreadyUsed={storageService.hasUserCopiedCode(code.id, currentUser)}
                isOwnCode={storageService.isOwnCode(code.id, currentUser)}
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
            placeholder="粘贴红包口令"
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
