import { useMemo } from 'react';
import type { TeamData, Pokemon } from '../types';
import { getPokeIcon, displayNatureName, normalizeNatureName, calculatePokemonTransitionCost } from '../utils';

const STATS: ('hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe')[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

interface CompareBuildCardProps {
  team: TeamData;
  poke: Pokemon;
  isReference: boolean;
  onSetReference: () => void;
  refPoke?: Pokemon;
  allBuilds: { team: TeamData; poke: Pokemon }[];
}

const CompareBuildCard = ({ 
  team, 
  poke, 
  isReference, 
  onSetReference,
  refPoke,
  allBuilds
}: CompareBuildCardProps) => {
  // Transition cost compared to reference
  const costTo = refPoke && !isReference ? calculatePokemonTransitionCost(refPoke, poke) : 0;
  const costFrom = refPoke && !isReference ? calculatePokemonTransitionCost(poke, refPoke) : 0;
  
  // Find other compatible builds (transition <= 30 VP in either direction)
  const compatibleWith = useMemo(() => {
    const list: { player_name: string; costTo: number; costFrom: number }[] = [];
    allBuilds.forEach(item => {
      if (item.team.player_name === team.player_name) return;
      const cTo = calculatePokemonTransitionCost(poke, item.poke);
      const cFrom = calculatePokemonTransitionCost(item.poke, poke);
      if (cTo <= 30 || cFrom <= 30) {
        list.push({
          player_name: item.team.player_name,
          costTo: cTo,
          costFrom: cFrom
        });
      }
    });
    return list;
  }, [allBuilds, poke, team.player_name]);

  // Exact changes breakdown from reference
  const transitionBreakdown = useMemo(() => {
    if (!refPoke || isReference) return [];
    const items: string[] = [];
    if (refPoke.ability !== poke.ability) {
      items.push(`Trocar Habilidade (${refPoke.ability || 'Sem'} ➔ ${poke.ability || 'Sem'}): +500 VP`);
    }
    if (normalizeNatureName(refPoke.nature) !== normalizeNatureName(poke.nature)) {
      items.push(`Trocar Nature (${displayNatureName(refPoke.nature)} ➔ ${displayNatureName(poke.nature)}): +500 VP`);
    }
    const refMoves = refPoke.moves.filter(Boolean);
    const pokeMoves = poke.moves.filter(Boolean);
    const movesToLearn = pokeMoves.filter(m => !refMoves.includes(m));
    if (movesToLearn.length > 0) {
      items.push(`Aprender golpes (${movesToLearn.join(', ')}): +${movesToLearn.length * 250} VP`);
    }
    STATS.forEach(s => {
      if (poke.evs[s] > refPoke.evs[s]) {
        const diff = poke.evs[s] - refPoke.evs[s];
        items.push(`+${diff} EVs em ${s.toUpperCase()}: +${diff * 5} VP`);
      }
    });
    return items;
  }, [refPoke, poke, isReference]);

  return (
    <div className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
      isReference 
        ? 'bg-pink-950/15 border-pink-500/50 shadow-md shadow-pink-500/5' 
        : (costTo <= 30 || costFrom <= 30)
          ? 'bg-emerald-950/10 border-emerald-500/40 hover:border-emerald-500/60 shadow-sm'
          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/50'
    }`}>
      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="min-w-0">
          <span className="font-bold text-sm text-slate-100 truncate block">{team.player_name}</span>
          {team.rental_code && (
            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded select-all mt-1 inline-block">
              {team.rental_code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isReference ? (
            <span className="text-[10px] bg-pink-600 text-white font-bold px-2 py-0.5 rounded">
              ⭐ Referência
            </span>
          ) : (
            <button 
              onClick={onSetReference}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-350 px-2 py-0.5 rounded transition-colors cursor-pointer"
            >
              Definir Referência
            </button>
          )}
        </div>
      </div>

      {/* Build Details */}
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <span className="text-slate-500 font-bold block text-[9px] uppercase">Item</span>
          <span className="font-mono text-slate-300 truncate block">{poke.item || 'Nenhum'}</span>
        </div>
        <div>
          <span className="text-slate-500 font-bold block text-[9px] uppercase">Habilidade</span>
          <span className="text-slate-300 truncate block">{poke.ability || 'Nenhuma'}</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500 font-bold block text-[9px] uppercase">Nature</span>
          <span className="text-slate-300">{displayNatureName(poke.nature)}</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500 font-bold block text-[9px] uppercase mb-1">Golpes</span>
          <div className="grid grid-cols-2 gap-1 bg-slate-950/45 p-1.5 rounded border border-slate-900">
            {poke.moves.map((move, i) => (
              <span key={i} className="text-slate-300 truncate font-medium">
                {move || <span className="text-slate-700 italic">• Vazio</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <span className="text-slate-500 font-bold block text-[9px] uppercase mb-1">EVs</span>
          <div className="grid grid-cols-6 gap-0.5">
            {STATS.map(s => (
              <div key={s} className="bg-slate-950/60 rounded p-1 text-center border border-slate-900">
                <div className="text-[7px] uppercase text-slate-500 font-bold">{s}</div>
                <div className="text-[9.5px] text-slate-300 font-mono font-semibold">{poke.evs[s]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transition signaling */}
      {!isReference && refPoke && (
        <div className="mt-2 pt-2 border-t border-slate-800/40 text-[10px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500">Transição:</span>
              <div className="flex gap-2 text-right">
                <span className={`font-mono font-bold ${costTo <= 30 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  Ida: {costTo} VP
                </span>
                <span className={`font-mono font-bold ${costFrom <= 30 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  Volta: {costFrom} VP
                </span>
              </div>
            </div>
            
            {/* If either cost is <= 30, signal with a badge */}
            {(costTo <= 30 || costFrom <= 30) && (
              <div className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 rounded p-1.5 font-bold flex items-center justify-center gap-1">
                <span>⚡ Transição barata (≤ 30 VP)</span>
              </div>
            )}

            {/* List other teams with transition cost <= 30 VP */}
            {compatibleWith.length > 0 && (
              <div className="mt-1 bg-slate-950/40 border border-slate-900 rounded p-1.5 flex flex-col gap-0.5">
                <span className="text-[8.5px] text-slate-500 uppercase font-bold">Compatibilidades (≤ 30 VP):</span>
                {compatibleWith.map(comp => (
                  <div key={comp.player_name} className="flex justify-between items-center text-[9px] text-emerald-400/90">
                    <span className="font-semibold">{comp.player_name}</span>
                    <span className="font-mono text-[8.5px]">
                      {comp.costTo <= 30 ? `→ ${comp.costTo} VP` : ''} 
                      {comp.costTo <= 30 && comp.costFrom <= 30 ? ' | ' : ''}
                      {comp.costFrom <= 30 ? `← ${comp.costFrom} VP` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Transition breakdown */}
            {transitionBreakdown.length > 0 && (
              <details className="text-[9px] text-slate-500 mt-1 cursor-pointer">
                <summary className="hover:text-slate-400 transition-colors">Ver detalhes da transição...</summary>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {transitionBreakdown.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {isReference && compatibleWith.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-800/40 text-[10px]">
          <div className="bg-slate-950/40 border border-slate-900 rounded p-1.5 flex flex-col gap-0.5">
            <span className="text-[8.5px] text-slate-500 uppercase font-bold">Compatibilidades da Referência (≤ 30 VP):</span>
            {compatibleWith.map(comp => (
              <div key={comp.player_name} className="flex justify-between items-center text-[9px] text-emerald-400/90">
                <span className="font-semibold">{comp.player_name}</span>
                <span className="font-mono text-[8.5px]">
                  {comp.costTo <= 30 ? `→ ${comp.costTo} VP` : ''} 
                  {comp.costTo <= 30 && comp.costFrom <= 30 ? ' | ' : ''}
                  {comp.costFrom <= 30 ? `← ${comp.costFrom} VP` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CompareTeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeams: TeamData[];
  pokemonFrequencies: { name: string; count: number; variations: number }[];
  comparePokemon: string;
  setComparePokemon: (name: string) => void;
  compareReferenceTeam: string;
  setCompareReferenceTeam: (name: string) => void;
}

const CompareTeamsModal = ({
  isOpen,
  onClose,
  activeTeams,
  pokemonFrequencies,
  comparePokemon,
  setComparePokemon,
  compareReferenceTeam,
  setCompareReferenceTeam
}: CompareTeamsModalProps) => {
  const activeComparePokemon = useMemo(() => {
    return comparePokemon || (pokemonFrequencies.length > 0 ? pokemonFrequencies[0].name : '');
  }, [comparePokemon, pokemonFrequencies]);

  const activeReferenceTeam = useMemo(() => {
    if (compareReferenceTeam) return compareReferenceTeam;
    if (!activeComparePokemon) return '';
    const firstTeam = activeTeams.find(t => t.team.some(p => p.name === activeComparePokemon));
    return firstTeam ? firstTeam.player_name : '';
  }, [compareReferenceTeam, activeComparePokemon, activeTeams]);

  const teamsWithComparePokemon = useMemo(() => {
    if (!activeComparePokemon) return [];
    return activeTeams.filter(t => t.team.some(p => p.name === activeComparePokemon));
  }, [activeTeams, activeComparePokemon]);

  if (!isOpen) return null;

  const builds = teamsWithComparePokemon.map(t => {
    const poke = t.team.find(p => p.name === activeComparePokemon)!;
    return { team: t, poke };
  });
  const refBuild = builds.find(b => b.team.player_name === activeReferenceTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-pink-400">⚖️ Análise Comparativa por Pokémon</h2>
            <p className="text-[11px] text-slate-400 mt-1">Escolha um Pokémon repetido e compare suas builds em todos os times em que ele aparece.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="mb-4 shrink-0">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Selecione o Pokémon para Comparar</label>
          <select
            value={activeComparePokemon}
            onChange={e => {
              setComparePokemon(e.target.value);
              setCompareReferenceTeam('');
            }}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-pink-500"
          >
            <option value="">Selecione um Pokémon...</option>
            {pokemonFrequencies.map(f => (
              <option key={f.name} value={f.name}>
                {f.name} (Aparece em {f.count} times • {f.variations} {f.variations === 1 ? 'variação' : 'variações'})
              </option>
            ))}
          </select>
        </div>

        {activeComparePokemon ? (
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {refBuild && (
              <div className="mb-4 bg-pink-950/10 border border-pink-500/30 rounded-xl p-3 flex items-center gap-3">
                <img 
                  src={getPokeIcon(activeComparePokemon)} 
                  alt={activeComparePokemon} 
                  className="w-10 h-10 object-contain filter drop-shadow-md"
                  onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')}
                />
                <div>
                  <span className="text-[10px] text-pink-400 font-extrabold uppercase tracking-wider block">Build de Referência Atual</span>
                  <span className="text-sm font-bold text-slate-100">{refBuild.team.player_name}</span>
                  <span className="text-slate-400 text-[11px] ml-2">
                    ({refBuild.poke.item || 'Sem item'} • {refBuild.poke.ability || 'Sem habilidade'} • {displayNatureName(refBuild.poke.nature)})
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {builds.map(({ team, poke }) => (
                <CompareBuildCard
                  key={team.player_name}
                  team={team}
                  poke={poke}
                  isReference={team.player_name === activeReferenceTeam}
                  onSetReference={() => setCompareReferenceTeam(team.player_name)}
                  refPoke={refBuild?.poke}
                  allBuilds={builds}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-slate-950/50 border border-dashed border-slate-800 rounded p-8 flex flex-col items-center justify-center text-slate-500 text-sm">
            <span>Nenhum Pokémon selecionado. Escolha um Pokémon no menu acima para começar.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareTeamsModal;
