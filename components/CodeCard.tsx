
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
    <div className="w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* w-full to fill the container, ensuring equal margins on both sides via parent padding */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 transition-all hover:shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Invitation code: small (13px) and strictly on one line */}
            <span className={`font-mono font-bold text-[13px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis select-all transition-colors ${isAlreadyUsed || isOwnCode ? 'text-slate-300' : 'text-slate-900'}`}>
              {code.content}
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider">
              {timeString}
            </span>
          </div>

          {/* Copy button: text horizontal (side-by-side) */}
          <button
            onClick={handleCopy}
            disabled={isAlreadyUsed && !copied || isOwnCode}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 min-w-[80px] ${
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
        
        {/* Remaining count: plain text, no button style */}
        <div className="flex justify-end mt-2">
            <span className="text-[10px] text-slate-400 font-medium">
              剩余: <span className={`${isAlreadyUsed || isOwnCode ? 'text-slate-400' : 'text-slate-700'} font-bold`}>{code.remainingUses}</span>
            </span>
        </div>
      </div>
    </div>
  );
};
