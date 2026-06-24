import React from 'react';
import type { TeamData } from '../types';
import PokemonIcon from './PokemonIcon';

interface TeamCardRowProps {
  team: TeamData;
  isExcluded: boolean;
  isIsolated: boolean;
  toggleExcludeTeam: (name: string) => void;
  setViewingTeam: (team: TeamData) => void;
  setActiveTooltip: React.Dispatch<React.SetStateAction<{
    name: string;
    nature?: string;
    sharingMode?: 'identical' | 'copy' | null;
    x: number;
    y: number;
  } | null>>;
}

const TeamCardRow = React.memo(({ 
  team, 
  isExcluded, 
  isIsolated, 
  toggleExcludeTeam, 
  setViewingTeam, 
  setActiveTooltip 
}: TeamCardRowProps) => {
  return (
    <div className={`flex flex-col justify-between p-2 px-2.5 rounded-lg border transition-all w-full h-[65px] ${isExcluded
        ? 'opacity-40 bg-slate-950/20 border-slate-900 shadow-none'
        : isIsolated
          ? 'bg-amber-950/15 border-amber-500/30 hover:bg-amber-950/25 hover:border-amber-500/40 shadow-sm shadow-amber-500/5'
          : 'bg-indigo-950/15 border-indigo-900/20 hover:bg-indigo-950/30 hover:border-indigo-900/35'
      }`}>
      {/* Top Row: Player Name and Rental Code */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="font-bold text-xs text-slate-200 truncate">{team.player_name}</span>
        {team.rental_code && (
          <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded select-all shrink-0 max-w-[110px] truncate" title={team.rental_code}>
            {team.rental_code}
          </span>
        )}
      </div>

      {/* Bottom Row: Pokémon Icons and Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/30">
        <div className="flex gap-0.5 shrink-0">
          {team.team.map((p, i) => (
            <PokemonIcon key={i} poke={p} setActiveTooltip={setActiveTooltip} />
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingTeam(team);
            }}
            className="text-[10px] p-0.5 rounded hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Visualizar time completo"
          >
            🔍
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExcludeTeam(team.player_name);
            }}
            className={`text-[9px] p-0.5 rounded hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0 ${isExcluded ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-slate-350'}`}
            title={isExcluded ? "Incluir time nos cálculos" : "Omitir time dos cálculos"}
          >
            {isExcluded ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
    </div>
  );
});

TeamCardRow.displayName = 'TeamCardRow';

export default TeamCardRow;
