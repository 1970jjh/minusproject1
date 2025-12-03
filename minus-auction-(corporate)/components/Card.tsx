import React from 'react';
import { Briefcase, AlertOctagon } from 'lucide-react';

interface CardProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  hidden?: boolean;
  className?: string;
  isNew?: boolean;
}

export const Card: React.FC<CardProps> = ({ value, size = 'md', hidden = false, className = '' }) => {
  const sizeClasses = {
    sm: 'w-16 h-20 text-sm border',
    md: 'w-32 h-44 text-xl border-2',
    lg: 'w-64 h-80 text-5xl border-4',
  };

  if (hidden) {
    return (
      <div
        className={`${sizeClasses[size]} bg-slate-800 border-slate-600 rounded-sm flex flex-col items-center justify-center shadow-lg select-none relative overflow-hidden ${className}`}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <Briefcase className="text-slate-500 mb-2 w-1/3 h-1/3" />
        <span className="text-slate-500 font-mono font-bold tracking-widest">대외비</span>
      </div>
    );
  }

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        bg-slate-900 text-slate-100
        rounded-sm flex flex-col shadow-[0_0_15px_rgba(0,0,0,0.5)] select-none relative overflow-hidden
        border-slate-600
        ${className}
      `}
    >
      {/* Header Strip */}
      <div className="w-full h-[15%] bg-slate-800 border-b border-slate-600 flex items-center justify-between px-2">
        <span className="text-[0.4em] font-mono text-slate-400">프로젝트 ID: {Math.abs(value)}</span>
        <AlertOctagon className="w-[0.8em] h-[0.8em] text-red-500" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <span className="text-xs text-slate-500 font-mono tracking-widest mb-1">손실 평가액</span>
        <div className="font-mono font-bold text-red-500 flex items-baseline leading-none">
          <span>{value}</span>
          <span className="text-[0.4em] ml-1 text-slate-400">억</span>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full h-[20%] bg-slate-800/50 border-t border-slate-600 flex items-center justify-center">
         <div className="w-[80%] h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-600/50 w-2/3"></div>
         </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }}>
      </div>
    </div>
  );
};