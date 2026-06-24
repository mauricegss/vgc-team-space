import type { TeamData } from '../types';
import { getPokeIcon } from '../utils';

interface AverageBaseCostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeams: TeamData[];
  averageTeamA: string;
  averageTeamB: string;
  setAverageTeamA: (name: string) => void;
  setAverageTeamB: (name: string) => void;
  averageAnalysisData: {
    team: TeamData;
    teamTotal: number;
    baseTeamCount: number;
    pokemonBreakdown: { pokemon: string; averageCost: number }[];
  }[];
}

const AverageBaseCostsModal = ({
  isOpen,
  onClose,
  activeTeams,
  averageTeamA,
  averageTeamB,
  setAverageTeamA,
  setAverageTeamB,
  averageAnalysisData
}: AverageBaseCostsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-5">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-cyan-400">Média contra a Base</h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Calcula a média de VP de cada Pokémon contra todos os outros times, excluindo os dois selecionados da base.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">x</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Time 1</label>
            <select 
              value={averageTeamA} 
              onChange={e => setAverageTeamA(e.target.value)} 
              className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="">Selecione um time...</option>
              {activeTeams.map(t => (
                <option key={t.player_name} value={t.player_name} disabled={t.player_name === averageTeamB}>
                  {t.player_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Time 2</label>
            <select 
              value={averageTeamB} 
              onChange={e => setAverageTeamB(e.target.value)} 
              className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="">Selecione um time...</option>
              {activeTeams.map(t => (
                <option key={t.player_name} value={t.player_name} disabled={t.player_name === averageTeamA}>
                  {t.player_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {averageAnalysisData.length === 0 ? (
            <div className="md:col-span-2 bg-slate-950/50 border border-dashed border-slate-800 rounded p-8 text-center text-sm text-slate-500">
              Selecione pelo menos um time para calcular.
            </div>
          ) : (
            averageAnalysisData.map(result => (
              <div key={result.team.player_name} className="bg-slate-900/35 border border-slate-800 rounded p-3">
                <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b border-slate-800">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-100 truncate">{result.team.player_name}</h3>
                    {result.team.rental_code && (
                      <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/30 px-1 rounded">
                        {result.team.rental_code}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-cyan-400 font-bold text-sm">{result.teamTotal.toFixed(2)} VP</div>
                    <div className="text-[9px] text-slate-500">{result.baseTeamCount} na base</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {result.pokemonBreakdown.map(item => (
                    <div key={item.pokemon} className="flex items-center justify-between gap-2 bg-slate-950/50 border border-slate-800 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={getPokeIcon(item.pokemon)} 
                          alt={item.pokemon} 
                          className="w-6 h-6 object-contain shrink-0" 
                          onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} 
                        />
                        <span className="text-xs font-bold text-slate-300 truncate">{item.pokemon}</span>
                      </div>
                      <span className="text-xs font-mono text-cyan-300 shrink-0">{item.averageCost.toFixed(2)} VP</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AverageBaseCostsModal;
