import { Team } from '../types';
import { Card } from './Card';
import { Chip } from './Chip';
import { Building2, Users } from 'lucide-react';

interface PlayerPanelProps {
  team: Team;
  isActive: boolean;
  isWinner?: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ team, isActive, isWinner }) => {
  const sortedCards = [...team.cards].sort((a, b) => a - b);
  const activeMembers = team.members.length;

  return (
    <div
      className={`
        relative flex flex-col rounded-sm transition-all duration-300 border
        ${isActive ? 'bg-slate-800 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)] z-10 scale-[1.02]' : 'bg-slate-900 border-slate-700 opacity-90'}
        ${isWinner ? 'bg-yellow-900/20 border-yellow-400 ring-2 ring-yellow-500/30' : ''}
      `}
    >
      {/* Header */}
      <div className={`
        flex justify-between items-center p-2 border-b
        ${isActive ? 'bg-slate-800 border-yellow-500/50' : 'bg-slate-950 border-slate-800'}
      `}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`p-1 rounded shrink-0 ${isActive ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-800 text-slate-500'}`}>
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex flex-col overflow-hidden">
             <span className={`font-bold font-mono text-sm tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
               {team.name}
             </span>
             <span className="text-[9px] text-slate-600 font-mono leading-none flex items-center gap-1">
               {team.groupNumber}조
             </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              <Users className="w-2.5 h-2.5 text-slate-500" />
              <span className={`text-[10px] font-mono ${activeMembers > 0 ? 'text-green-500' : 'text-slate-600'}`}>{activeMembers}</span>
           </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center justify-between p-2 bg-slate-900/50">
         <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">보유 자원</span>
            <Chip count={team.chips} className="scale-75 origin-left" />
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase">예상 순이익</span>
            <span className={`font-mono font-bold text-sm ${team.score > -30 ? 'text-blue-400' : 'text-red-400'}`}>
               {team.score}억
            </span>
         </div>
      </div>

      {/* Project Portfolio */}
      <div className="flex-1 min-h-[3rem] p-2 flex flex-wrap gap-1 items-start content-start bg-black/20">
        {sortedCards.length === 0 ? (
          <span className="text-[10px] text-slate-700 w-full text-center mt-2 font-mono">보유 프로젝트 없음</span>
        ) : (
          sortedCards.map((card) => {
            const isHead = !sortedCards.includes(card + 1);
            return (
              <div key={card} className={`relative transition-all ${!isHead ? 'opacity-30 grayscale scale-90' : 'hover:-translate-y-1'}`}>
                 <Card value={card} size="sm" className="!w-10 !h-12 !text-[10px] !border" />
              </div>
            );
          })
        )}
      </div>

      {/* Active Turn Indicator */}
      {isActive && (
        <div className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
        </div>
      )}

      {/* Action Status Overlay */}
      {team.lastAction && !isActive && (
         <div className={`
            absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-[1px]
            z-20 animate-in fade-in duration-200
         `}>
           <div className={`
             px-4 py-1 rounded border-2 font-bold text-sm shadow-xl flex items-center gap-2
             ${team.lastAction === 'TAKE' ? 'border-red-500 text-red-500 bg-red-950' : 'border-slate-500 text-slate-300 bg-slate-800'}
           `}>
             {team.lastAction === 'TAKE' ? '낙찰 (TAKEN)' : '패스 (PASS)'}
           </div>
         </div>
      )}
    </div>
  );
};
