import { useState } from 'react';
import type { TeamData } from '../types';
import { getPokeIcon, displayNatureName, exportToPokepaste } from '../utils';

interface ViewTeamModalProps {
  viewingTeam: TeamData | null;
  onClose: () => void;
  deleteTeam: (playerName: string) => void;
}

const ViewTeamModal = ({
  viewingTeam,
  onClose,
  deleteTeam
}: ViewTeamModalProps) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!viewingTeam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-5 flex flex-col">
        <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>📋 Detalhes do Time - {viewingTeam.player_name}</span>
            </h2>
            {viewingTeam.rental_code && (
              <span className="text-xs text-indigo-300 font-mono bg-indigo-900/30 px-2 py-0.5 rounded select-all mt-1 inline-block">
                Rental Code: {viewingTeam.rental_code}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 overflow-y-auto pr-1 custom-scrollbar">
          {/* Pokémon cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {viewingTeam.team.map((p, idx) => (
              <div key={p.name + "-" + idx} className="bg-slate-900/35 border border-slate-800 rounded p-3">
                <div className="flex items-start gap-2 mb-2">
                  <img 
                    src={getPokeIcon(p.name)} 
                    alt={p.name} 
                    className="w-8 h-8 object-contain shrink-0" 
                    onError={(e) => (e.currentTarget.src = "https://r2.limitlesstcg.net/pokemon/gen9/unown.png")} 
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-100 truncate">{p.name || '???'}</div>
                    <div className="text-[10px] text-slate-400 truncate">{p.item || "Sem item"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                  <div>
                    <span className="block uppercase font-bold text-slate-500">Ability</span>
                    <span className="text-slate-300">{p.ability || "-"}</span>
                  </div>
                  <div>
                    <span className="block uppercase font-bold text-slate-500">Nature</span>
                    <span className="text-slate-300">{displayNatureName(p.nature)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1 mb-2">
                  {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map(stat => (
                    <div key={stat} className="bg-slate-950/70 rounded px-1 py-0.5 text-center">
                      <div className="text-[7px] uppercase text-slate-500 font-bold">{stat}</div>
                      <div className="text-[9px] text-slate-300 font-mono">{p.evs[stat] || 0}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {p.moves.map((move, midx) => (
                    <span key={midx} className="bg-slate-950/50 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-300 truncate" title={move}>
                      {move || "Vazio"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pokepaste panel on the right */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Texto Pokepaste</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(exportToPokepaste(viewingTeam));
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded transition-all cursor-pointer"
              >
                {isCopied ? "✓ Copiado!" : "Copiar Texto"}
              </button>
            </div>
            <textarea
              readOnly
              value={exportToPokepaste(viewingTeam)}
              className="w-full flex-1 min-h-[200px] md:min-h-[300px] bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 select-all focus:outline-none custom-scrollbar resize-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-5 shrink-0">
          <button
            onClick={() => deleteTeam(viewingTeam.player_name)}
            className="bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-red-355 border border-red-900/50 hover:border-red-500/50 text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>🗑️</span> Excluir Time
          </button>
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-6 py-2 rounded-lg transition-all cursor-pointer">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewTeamModal;
