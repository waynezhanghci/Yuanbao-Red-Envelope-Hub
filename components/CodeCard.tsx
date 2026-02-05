
import React from 'react';
import { InvitationCode } from '../types';

interface CodeCardProps {
  code: InvitationCode;
  onUse: () => Promise<boolean>; // Changed to Promise
  alreadyUsed?: boolean;
  isOwnCode?: boolean;
}

export const CodeCard: React.FC<CodeCardProps> = ({ code, onUse, alreadyUsed = false, isOwnCode = false }) => {
  const [copied, setCopied] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Local state to track if we just used it, combined with props
  const [localUsed, setLocalUsed] = React.useState(false);
  const isEffectiveUsed = alreadyUsed || localUsed;

  const handleCopy = async () => {
    if (isEffectiveUsed || isOwnCode || isLoading) return;

    setIsLoading(true);
    
    // Call parent to check business rules (API call)
    const success = await onUse();
    
    setIsLoading(false);

    if (!success) return;

    try {
      await navigator.clipboard.writeText(code.content);
      setCopied(true);
      setLocalUsed(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const timeString = new Date(code.createdAt).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 transition-all hover:shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className={`font-mono font-bold text-[13px] leading-relaxed line-clamp-2 break-words select-all transition-colors ${isEffectiveUsed || isOwnCode ? 'text-slate-300' : 'text-slate-900'}`}>
              {code.content}
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider">
              {timeString}
            </span>
          </div>

          <button
            onClick={handleCopy}
            disabled={(isEffectiveUsed && !copied) || isOwnCode || isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 min-w-[80px] ${
              copied 
                ? 'bg-green-100 text-green-700' 
                : isOwnCode
                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                  : isEffectiveUsed 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : isLoading
                      ? 'bg-red-400 text-white cursor-wait'
                      : 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm'
            }`}
          >
            {isLoading ? (
               <i className="fas fa-spinner fa-spin text-[10px]"></i>
            ) : (
               <i className={`fas ${copied ? 'fa-check' : isOwnCode ? 'fa-user' : isEffectiveUsed ? 'fa-check-double' : 'fa-copy'} text-[10px]`}></i>
            )}
            <span className="whitespace-nowrap">
              {copied ? '已复制' : isOwnCode ? '我的' : isEffectiveUsed ? '已领取' : isLoading ? '领取中' : '复制'}
            </span>
          </button>
        </div>
        
        <div className="flex justify-end mt-2">
            <span className="text-[10px] text-slate-400 font-medium">
              剩余: <span className={`${isEffectiveUsed || isOwnCode ? 'text-slate-400' : 'text-slate-700'} font-bold`}>{code.remainingUses}</span>
            </span>
        </div>
      </div>
    </div>
  );
};
