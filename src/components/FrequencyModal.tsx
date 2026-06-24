import React from 'react';
import { getPokeIcon } from '../utils';

interface FrequencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  pokemonFrequencies: { name: string; count: number; variations: number }[];
  pokemonCopies: Record<string, number>;
  setPokemonCopies: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

const FrequencyModal = ({ 
  isOpen, 
  onClose, 
  pokemonFrequencies, 
  pokemonCopies, 
  setPokemonCopies 
}: FrequencyModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-blue-400">📊 Frequência & Cópias</h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Ajuste o número de <strong>Cópias</strong> se você possui múltiplas cópias físicas do mesmo Pokémon (por exemplo, possuir 2 cópias permite usar 2 builds diferentes dele no mesmo trio sem custo de transição).
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pokemonFrequencies.map(({ name, count, variations }) => {
            const copies = pokemonCopies[name] || 1;
            return (
              <div 
                key={name} 
                className={`flex items-center justify-between p-2 rounded border transition-all ${
                  copies > 1 
                    ? 'bg-blue-950/40 border-blue-500/50' 
                    : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img 
                    src={getPokeIcon(name)} 
                    alt={name} 
                    className="w-6 h-6 object-contain shrink-0" 
                    onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} 
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[11px] text-slate-200 truncate">{name}</span>
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">
                      {count} {count === 1 ? 'vez' : 'vezes'} • {variations} {variations === 1 ? 'variação' : 'variações'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/45 p-1 px-2.5 rounded-lg border border-slate-800/60 shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold">Cópias:</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      const current = pokemonCopies[name] || 1;
                      if (current > 1) {
                        setPokemonCopies(prev => {
                          const next = { ...prev };
                          if (current === 2) {
                            delete next[name];
                          } else {
                            next[name] = current - 1;
                          }
                          return next;
                        });
                      }
                    }} 
                    className="w-4 h-4 flex items-center justify-center bg-slate-800 text-[10px] text-slate-355 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    -
                  </button>
                  <span className={`text-[10px] font-mono font-bold w-3 text-center ${copies > 1 ? 'text-blue-400 font-extrabold' : 'text-slate-450'}`}>{copies}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      const current = pokemonCopies[name] || 1;
                      setPokemonCopies(prev => ({
                        ...prev,
                        [name]: current + 1
                      }));
                    }} 
                    className="w-4 h-4 flex items-center justify-center bg-slate-800 text-[10px] text-slate-355 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end pt-4 border-t border-slate-800 mt-4 shrink-0">
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2 rounded-lg transition-all">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrequencyModal;
