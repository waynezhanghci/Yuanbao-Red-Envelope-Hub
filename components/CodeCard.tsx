
import React from 'react';
import { InvitationCode } from '../types';

interface CodeCardProps {
  code: InvitationCode;
  onUse: () => boolean;
  alreadyUsed?: boolean;
  isOwnCode?: boolean;
}

export const CodeCard: React.FC<CodeCardProps> = ({ code, onUse, alreadyUsed = false, isOwnCode = false }) => {
  const [copied, setCopied] = React.useState(false);
  const [isAlreadyUsed, setIsAlreadyUsed] = React.useState(alreadyUsed);

  const handleCopy = async () => {
    if (isAlreadyUsed || isOwnCode) return;

    // Call parent to check business rules (daily limit, etc.)
    const success = onUse();
    if (!success) return;

    try {
      await navigator.clipboard.writeText(code.content);
      setCopied(true);
      setIsAlreadyUsed(true);
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
    <div className="w-full mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-100 p-3 transition-all hover:shadow-md">
        
        {/* Top Row: Flex container with items-stretch to match heights */}
        <div className="flex justify-between items-stretch gap-3">
          {/* Text Container: Center content vertically if button is taller, or allow text to dictate height */}
          <div className="flex-1 min-w-0 flex items-center">
            <span className={`font-mono font-bold text-[13px] leading-relaxed line-clamp-2 break-words select-all transition-colors ${isAlreadyUsed || isOwnCode ? 'text-slate-300' : 'text-slate-900'}`}>
              {code.content}
            </span>
          </div>

          {/* Button: h-auto to stretch with parent, min-h-[32px] for touch target */}
          <button
            onClick={handleCopy}
            disabled={isAlreadyUsed && !copied || isOwnCode}
            className={`flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 min-w-[72px] h-auto min-h-[32px] ${
              copied 
                ? 'bg-green-100 text-green-700' 
                : isOwnCode
                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                  : isAlreadyUsed 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm'
            }`}
          >
            <i className={`fas ${copied ? 'fa-check' : isOwnCode ? 'fa-user' : isAlreadyUsed ? 'fa-check-double' : 'fa-copy'} text-[10px]`}></i>
            <span className="whitespace-nowrap">
              {copied ? '已复制' : isOwnCode ? '我的' : isAlreadyUsed ? '已领取' : '复制'}
            </span>
          </button>
        </div>
        
        {/* Bottom Row: Time (Left) and Remaining Count (Right) */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-medium">
          <span>{timeString}</span>
          <span>
            剩余: <span className={`${isAlreadyUsed || isOwnCode ? 'text-slate-400' : 'text-slate-700'} font-bold`}>{code.remainingUses}</span>
          </span>
        </div>

      </div>
    </div>
  );
};
