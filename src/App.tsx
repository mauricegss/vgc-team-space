import { useState, useMemo, useEffect } from 'react';
import rawData from '../dados-completos.json';
import type { TeamData, Pokemon } from './types';
import { findIsolatedTeams, getPokeIcon, calculateTeamTransitionCost, calculatePokemonTransitionCost, parsePokepaste, displayNatureName, normalizeNatureName, calculateAverageBaseCosts, countPokemonVariations, calculateComboTotalVp, areTeamsCompatible, getPokemonSharingMode } from './utils';

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
          <div className="grid grid-cols-2 gap-1 bg-slate-950/40 p-1.5 rounded border border-slate-900">
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

const normalizeSelectedTeamSlots = (value: unknown) => {
  const slots = Array.isArray(value) ? value : [];
  return [0, 1, 2].map(index => typeof slots[index] === 'string' ? slots[index] : '');
};

function App() {
  const [activeTooltip, setActiveTooltip] = useState<{
    name: string;
    nature?: string;
    sharingMode?: 'identical' | 'copy' | null;
    x: number;
    y: number;
  } | null>(null);

  const [teams, setTeams] = useState<TeamData[]>(() => {
    const initialData = Array.isArray(rawData) ? rawData : (rawData as { default?: TeamData[] }).default || [];
    try {
      const deleted = JSON.parse(localStorage.getItem('vgc_deleted_teams') || '[]');
      if (deleted.length > 0) {
        return (initialData as TeamData[]).filter(t => !deleted.includes(t.player_name));
      }
    } catch {
      // ignore
    }
    return initialData as TeamData[];
  });


  // Selected Combo State
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() => {
    try {
      return normalizeSelectedTeamSlots(JSON.parse(localStorage.getItem('vgc_selected_combo_teams') || '["", "", ""]'));
    } catch {
      return ['', '', ''];
    }
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newRentalCode, setNewRentalCode] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const parsedPasteTeam = useMemo(() => parsePokepaste(pasteInput), [pasteInput]);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [pokemonCopies, setPokemonCopies] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('vgc_pokemon_copies') || '{}');
    } catch {
      return {};
    }
  });

  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showAverageModal, setShowAverageModal] = useState(false);
  const [averageTeamA, setAverageTeamA] = useState<string>('');
  const [averageTeamB, setAverageTeamB] = useState<string>('');
  const [teamA, setTeamA] = useState<string>('');
  const [teamB, setTeamB] = useState<string>('');
  const [viewingTeam, setViewingTeam] = useState<TeamData | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [excludedTeamNames, setExcludedTeamNames] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('vgc_excluded_teams') || '[]');
    } catch {
      return [];
    }
  });

  const toggleExcludeTeam = (teamName: string) => {
    setExcludedTeamNames(prev => {
      const isExcluded = prev.includes(teamName);
      if (isExcluded) {
        return prev.filter(name => name !== teamName);
      } else {
        setSelectedTeams(prevSel => prevSel.map(name => name === teamName ? '' : name));
        if (teamA === teamName) setTeamA('');
        if (teamB === teamName) setTeamB('');
        if (averageTeamA === teamName) setAverageTeamA('');
        if (averageTeamB === teamName) setAverageTeamB('');
        return [...prev, teamName];
      }
    });
  };

  useEffect(() => {
    localStorage.removeItem('vgc_custom_teams');
    localStorage.removeItem('vgc_full_teams_json');
  }, []);

  useEffect(() => {
    localStorage.setItem('vgc_pokemon_copies', JSON.stringify(pokemonCopies));
  }, [pokemonCopies]);

  useEffect(() => {
    localStorage.setItem('vgc_excluded_teams', JSON.stringify(excludedTeamNames));
  }, [excludedTeamNames]);

  useEffect(() => {
    localStorage.setItem('vgc_selected_combo_teams', JSON.stringify(selectedTeams));
  }, [selectedTeams]);

  const cleanTeamsForJson = (teamsToExport: TeamData[]) => (
    teamsToExport.map(teamData => ({
      player_name: teamData.player_name,
      team: teamData.team,
      ...(teamData.rental_code ? { rental_code: teamData.rental_code } : {}),
    }))
  );

  const exportToPokepaste = (teamData: TeamData) => {
    return teamData.team
      .map(p => {
        if (!p.name) return '';
        let paste = `${p.name}`;
        if (p.item) paste += ` @ ${p.item}`;
        paste += '\n';
        if (p.ability) paste += `Ability: ${p.ability}\n`;
        paste += `Level: 50\n`;
        
        const evParts: string[] = [];
        if (p.evs.hp) evParts.push(`${p.evs.hp} HP`);
        if (p.evs.atk) evParts.push(`${p.evs.atk} Atk`);
        if (p.evs.def) evParts.push(`${p.evs.def} Def`);
        if (p.evs.spa) evParts.push(`${p.evs.spa} SpA`);
        if (p.evs.spd) evParts.push(`${p.evs.spd} SpD`);
        if (p.evs.spe) evParts.push(`${p.evs.spe} Spe`);
        if (evParts.length > 0) paste += `EVs: ${evParts.join(' / ')}\n`;
        
        if (p.nature) paste += `${p.nature} Nature\n`;
        
        p.moves.forEach(m => {
          if (m) paste += `- ${m}\n`;
        });
        return paste.trim() + '\n';
      })
      .filter(Boolean)
      .join('\n');
  };

  const deleteTeam = async (playerName: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir permanentemente o time de "${playerName}"?`)) {
      return;
    }
    const nextTeams = teams.filter(t => t.player_name !== playerName);
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTeamsForJson(nextTeams)),
      });

      if (!response.ok) {
        throw new Error('Não foi possível excluir o time do dados-completos.json.');
      }

      setTeams(nextTeams);
      setViewingTeam(null);
      setSelectedTeams(prev => prev.map(name => name === playerName ? '' : name));
      if (teamA === playerName) setTeamA('');
      if (teamB === playerName) setTeamB('');
      if (averageTeamA === playerName) setAverageTeamA('');
      if (averageTeamB === playerName) setAverageTeamB('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao excluir do JSON.');
    }
  };

  const saveNewTeam = async () => {
    if (isSavingTeam) return;
    const playerName = newTeamName.trim();
    const parsedTeam = parsePokepaste(pasteInput);
    if (!playerName) {
      setPasteError('Informe um nome para identificar o time.');
      return;
    }
    if (parsedTeam.length !== 6) {
      setPasteError(`Cole um Pokepaste com 6 Pokemon. Encontrei ${parsedTeam.length}.`);
      return;
    }

    const newTeam: TeamData = {
      player_name: playerName,
      team: parsedTeam,
    };
    if (newRentalCode.trim()) {
      newTeam.rental_code = newRentalCode.trim();
    }
    const nextTeams = [...teams, newTeam];
    setIsSavingTeam(true);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTeamsForJson(nextTeams)),
      });

      if (!response.ok) {
        throw new Error('Nao foi possivel escrever o dados-completos.json.');
      }

      setTeams(nextTeams);
      setNewTeamName('');
      setNewRentalCode('');
      setPasteInput('');
      setPasteError('');
      setShowAddModal(false);
    } catch (error) {
      setPasteError(error instanceof Error ? error.message : 'Erro ao salvar no JSON.');
    } finally {
      setIsSavingTeam(false);
    }
  };

  // Computed data
  const activeTeams = useMemo(() => {
    return teams.filter(t => !excludedTeamNames.includes(t.player_name));
  }, [teams, excludedTeamNames]);

  const isolatedTeams = useMemo(() => findIsolatedTeams(activeTeams, pokemonCopies), [activeTeams, pokemonCopies]);

  const nonIsolatedTeams = useMemo(() => {
    return activeTeams.filter(t => !isolatedTeams.some(iso => iso.player_name === t.player_name));
  }, [activeTeams, isolatedTeams]);

  // Slots selection options (cascading)
  const slot1Options = useMemo(() => {
    return activeTeams;
  }, [activeTeams]);

  const slot2Options = useMemo(() => {
    const t1Name = selectedTeams[0];
    const t3Name = selectedTeams[2];
    if (!t1Name) return [];
    const t1 = activeTeams.find(t => t.player_name === t1Name);
    if (!t1) return [];

    return activeTeams.filter(t => {
      if (t.player_name === t1Name || t.player_name === t3Name) return false;
      // Must be compatible with t1
      if (!areTeamsCompatible(t1, t, pokemonCopies)) return false;

      if (t3Name) {
        const t3 = activeTeams.find(x => x.player_name === t3Name);
        if (!t3) return false;
        // Directional compatibility check (one must be target, the other source)
        return areTeamsCompatible(t, t3, pokemonCopies) || areTeamsCompatible(t3, t, pokemonCopies);
      } else {
        // Must have at least one valid partner for Slot 3 in activeTeams
        return activeTeams.some(other => 
          other.player_name !== t1Name && 
          other.player_name !== t.player_name && 
          areTeamsCompatible(t1, other, pokemonCopies) && 
          (areTeamsCompatible(t, other, pokemonCopies) || areTeamsCompatible(other, t, pokemonCopies))
        );
      }
    });
  }, [activeTeams, selectedTeams, pokemonCopies]);

  const slot3Options = useMemo(() => {
    const t1Name = selectedTeams[0];
    const t2Name = selectedTeams[1];
    if (!t1Name) return [];
    const t1 = activeTeams.find(t => t.player_name === t1Name);
    if (!t1) return [];

    return activeTeams.filter(t => {
      if (t.player_name === t1Name || t.player_name === t2Name) return false;
      // Must be compatible with t1
      if (!areTeamsCompatible(t1, t, pokemonCopies)) return false;

      if (t2Name) {
        const t2 = activeTeams.find(x => x.player_name === t2Name);
        if (!t2) return false;
        // Directional compatibility check (one must be target, the other source)
        return areTeamsCompatible(t2, t, pokemonCopies) || areTeamsCompatible(t, t2, pokemonCopies);
      } else {
        // Must have at least one valid partner for Slot 2 in activeTeams
        return activeTeams.some(other => 
          other.player_name !== t1Name && 
          other.player_name !== t.player_name && 
          areTeamsCompatible(t1, other, pokemonCopies) && 
          (areTeamsCompatible(other, t, pokemonCopies) || areTeamsCompatible(t, other, pokemonCopies))
        );
      }
    });
  }, [activeTeams, selectedTeams, pokemonCopies]);

  const nonIsolatedSlot2Options = useMemo(() => {
    return slot2Options.filter(t => !isolatedTeams.some(iso => iso.player_name === t.player_name));
  }, [slot2Options, isolatedTeams]);

  const nonIsolatedSlot3Options = useMemo(() => {
    return slot3Options.filter(t => !isolatedTeams.some(iso => iso.player_name === t.player_name));
  }, [slot3Options, isolatedTeams]);

  const possibleFourthTeams = useMemo(() => {
    const t1Name = selectedTeams[0];
    const t2Name = selectedTeams[1];
    const t3Name = selectedTeams[2];

    // Need all 3 slots selected to make a replacement analysis meaningful
    if (!t1Name || !t2Name || !t3Name) return [];

    const t1 = activeTeams.find(t => t.player_name === t1Name);
    const t2 = activeTeams.find(t => t.player_name === t2Name);
    const t3 = activeTeams.find(t => t.player_name === t3Name);

    const candidates = activeTeams.filter(t => 
      t.player_name !== t1Name && 
      t.player_name !== t2Name && 
      t.player_name !== t3Name &&
      !isolatedTeams.some(iso => iso.player_name === t.player_name)
    );

    const list: {
      team: TeamData;
      replacements: { slotIndex: number; newTotalVp: number }[];
    }[] = [];

    candidates.forEach(candidate => {
      // Must have swap cost 0 with all selected teams individually
      const hasZeroCostWithAllSelected = [t1, t2, t3].every(selTeam => {
        if (!selTeam) return true;
        return calculateComboTotalVp([candidate, selTeam], pokemonCopies) === 0;
      });

      if (!hasZeroCostWithAllSelected) return;

      const replacements: { slotIndex: number; newTotalVp: number }[] = [];

      // Check Slot 1 replacement
      if (t1) {
        const isCompatible = 
          (!t2 || areTeamsCompatible(candidate, t2, pokemonCopies)) &&
          (!t3 || areTeamsCompatible(candidate, t3, pokemonCopies)) &&
          (!t2 || !t3 || areTeamsCompatible(t2, t3, pokemonCopies) || areTeamsCompatible(t3, t2, pokemonCopies));
        
        if (isCompatible) {
          const newCombo = [candidate, t2, t3].filter((x): x is TeamData => !!x);
          const vpCost = calculateComboTotalVp(newCombo, pokemonCopies);
          if (vpCost === 0) {
            replacements.push({ slotIndex: 1, newTotalVp: vpCost });
          }
        }
      }

      // Check Slot 2 replacement
      if (t2) {
        const isCompatible = 
          (!t1 || areTeamsCompatible(t1, candidate, pokemonCopies)) &&
          (!t1 || !t3 || areTeamsCompatible(t1, t3, pokemonCopies)) &&
          (!t3 || areTeamsCompatible(candidate, t3, pokemonCopies) || areTeamsCompatible(t3, candidate, pokemonCopies));

        if (isCompatible) {
          const newCombo = [t1, candidate, t3].filter((x): x is TeamData => !!x);
          const vpCost = calculateComboTotalVp(newCombo, pokemonCopies);
          if (vpCost === 0) {
            replacements.push({ slotIndex: 2, newTotalVp: vpCost });
          }
        }
      }

      // Check Slot 3 replacement
      if (t3) {
        const isCompatible = 
          (!t1 || !t2 || areTeamsCompatible(t1, t2, pokemonCopies)) &&
          (!t1 || areTeamsCompatible(t1, candidate, pokemonCopies)) &&
          (!t2 || areTeamsCompatible(t2, candidate, pokemonCopies) || areTeamsCompatible(candidate, t2, pokemonCopies));

        if (isCompatible) {
          const newCombo = [t1, t2, candidate].filter((x): x is TeamData => !!x);
          const vpCost = calculateComboTotalVp(newCombo, pokemonCopies);
          if (vpCost === 0) {
            replacements.push({ slotIndex: 3, newTotalVp: vpCost });
          }
        }
      }

      if (replacements.length > 0) {
        list.push({ team: candidate, replacements });
      }
    });

    return list;
  }, [selectedTeams, activeTeams, pokemonCopies, isolatedTeams]);

  const handleSlotChange = (index: number, name: string) => {
    setSelectedTeams(prev => {
      const next = [...prev];
      next[index] = name;
      if (index === 0) {
        next[1] = '';
        next[2] = '';
      } else {
        // Check if the other slot is compatible, if not, clear it
        const t2 = activeTeams.find(t => t.player_name === next[1]);
        const t3 = activeTeams.find(t => t.player_name === next[2]);
        if (t2 && t3) {
          const isComp = areTeamsCompatible(t2, t3, pokemonCopies) || areTeamsCompatible(t3, t2, pokemonCopies);
          if (!isComp) {
            if (index === 1) {
              next[2] = '';
            } else {
              next[1] = '';
            }
          }
        }
      }
      return next;
    });
  };

  const clearSlot = (index: number) => {
    setSelectedTeams(prev => {
      const next = prev.filter((_, idx) => idx !== index).filter(Boolean);
      while (next.length < 3) {
        next.push('');
      }
      return next;
    });
  };

  const selectedComboTeams = useMemo(() => {
    return selectedTeams
      .map(name => activeTeams.find(t => t.player_name === name))
      .filter((t): t is TeamData => !!t);
  }, [selectedTeams, activeTeams]);

  const comboTotalVp = useMemo(() => {
    if (selectedComboTeams.length < 2) return 0;
    return calculateComboTotalVp(selectedComboTeams, pokemonCopies);
  }, [selectedComboTeams, pokemonCopies]);



  const possiblePairsForSelectedTeam = useMemo(() => {
    const t1Name = selectedTeams[0];
    if (!t1Name) return [];

    // If t1 itself is isolated, return no pairs
    if (isolatedTeams.some(iso => iso.player_name === t1Name)) return [];

    const t1 = activeTeams.find(t => t.player_name === t1Name);
    if (!t1) return [];

    const candidates = nonIsolatedTeams.filter(t => t.player_name !== t1Name && areTeamsCompatible(t1, t, pokemonCopies));

    const pairs: { teamA: TeamData; teamB: TeamData | null; totalVp: number }[] = [];
    const matchedCandidates = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const tA = candidates[i];
        const tB = candidates[j];
        if (areTeamsCompatible(tA, tB, pokemonCopies)) {
          const totalVp = calculateComboTotalVp([t1, tA, tB], pokemonCopies);
          pairs.push({ teamA: tA, teamB: tB, totalVp });
          matchedCandidates.add(tA.player_name);
          matchedCandidates.add(tB.player_name);
        } else if (areTeamsCompatible(tB, tA, pokemonCopies)) {
          const totalVp = calculateComboTotalVp([t1, tB, tA], pokemonCopies);
          pairs.push({ teamA: tB, teamB: tA, totalVp });
          matchedCandidates.add(tA.player_name);
          matchedCandidates.add(tB.player_name);
        }
      }
    }

    // Add candidates that don't have any compatible pair among candidates
    candidates.forEach(t => {
      if (!matchedCandidates.has(t.player_name)) {
        const totalVp = calculateComboTotalVp([t1, t], pokemonCopies);
        pairs.push({ teamA: t, teamB: null, totalVp });
      }
    });

    return pairs.sort((a, b) => a.totalVp - b.totalVp);
  }, [activeTeams, nonIsolatedTeams, isolatedTeams, selectedTeams, pokemonCopies]);

  const orderedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const aExcluded = excludedTeamNames.includes(a.player_name);
      const bExcluded = excludedTeamNames.includes(b.player_name);
      if (aExcluded && !bExcluded) return 1;
      if (!aExcluded && bExcluded) return -1;

      const aIsolated = isolatedTeams.some(iso => iso.player_name === a.player_name);
      const bIsolated = isolatedTeams.some(iso => iso.player_name === b.player_name);
      if (aIsolated && !bIsolated) return -1;
      if (!aIsolated && bIsolated) return 1;

      return 0;
    });
  }, [teams, excludedTeamNames, isolatedTeams]);











  const pokemonFrequencies = useMemo(() => {
    const counts = new Map<string, number>();
    const buildsMap = new Map<string, Pokemon[]>();

    activeTeams.forEach(t => {
      t.team.forEach(p => {
        if (p.name) {
          counts.set(p.name, (counts.get(p.name) || 0) + 1);
          if (!buildsMap.has(p.name)) {
            buildsMap.set(p.name, []);
          }
          buildsMap.get(p.name)!.push(p);
        }
      });
    });

    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name, count]) => {
        const builds = buildsMap.get(name) || [];
        const variations = countPokemonVariations(builds);
        return { name, count, variations };
      })
      .sort((a, b) => b.count - a.count);
  }, [activeTeams]);

  const [comparePokemon, setComparePokemon] = useState<string>('');
  const [compareReferenceTeam, setCompareReferenceTeam] = useState<string>('');

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

  // comparisonData removed

  const averageAnalysisData = useMemo(() => {
    const selected = [averageTeamA, averageTeamB].filter(Boolean);
    if (!showAverageModal || selected.length === 0) return [];
    return calculateAverageBaseCosts(activeTeams, selected, pokemonCopies);
  }, [activeTeams, averageTeamA, averageTeamB, showAverageModal, pokemonCopies]);

  const PokemonIcon = ({ 
    poke, 
    sharingMode 
  }: { 
    poke: { name: string; nature?: string }; 
    sharingMode?: 'identical' | 'copy' | null;
  }) => {
    const ringClass = sharingMode === 'identical'
      ? 'ring-2 ring-emerald-400 bg-emerald-400/20 rounded-full'
      : sharingMode === 'copy'
        ? 'ring-2 ring-amber-500 bg-amber-500/20 rounded-full'
        : '';

    const handleMouseEnter = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveTooltip({
        name: poke.name,
        nature: poke.nature,
        sharingMode,
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    };

    const handleMouseLeave = () => {
      setActiveTooltip(null);
    };

    return (
      <div 
        className={`relative group/icon ${ringClass}`} 
        title={poke.nature ? `${poke.name} (${displayNatureName(poke.nature)})` : poke.name}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img src={getPokeIcon(poke.name)} alt={poke.name} className="w-6 h-6 object-contain filter drop-shadow-md pointer-events-none"
          onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} />
      </div>
    );
  };

  const TeamCardRow = ({ team }: { team: TeamData }) => {
    const isExcluded = excludedTeamNames.includes(team.player_name);
    const isIsolated = isolatedTeams.some(iso => iso.player_name === team.player_name);

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
            {team.team.map((p, i) => <PokemonIcon key={i} poke={p} />)}
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
  };

  return (
    <div className="h-screen p-2 sm:p-4 max-w-350 mx-auto flex flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-800">
        <h1 className="text-xl font-bold text-gradient tracking-tight">VGC Roster Architect</h1>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowAverageModal(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1.5 rounded font-bold shadow transition-all">
            Média Base
          </button>
          <button onClick={() => setShowCompareModal(true)} className="bg-pink-600 hover:bg-pink-500 text-white text-xs px-3 py-1.5 rounded font-bold shadow transition-all">
            ⚖️ Comparar Times
          </button>
          <button onClick={() => setShowAnalysisModal(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded font-bold shadow transition-all">
            📊 Frequência
          </button>
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-bold shadow transition-all">
            + Criar Time
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUNA ESQUERDA: Banco de Times */}
        <section className="glass rounded-lg p-2.5 border-t-2 border-emerald-500 h-full min-h-0 flex flex-col">
          <h2 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1 shrink-0">
            📋 Banco de Times {teams.length - activeTeams.length > 0 ? `(${teams.length} - ${teams.length - activeTeams.length}) = (${activeTeams.length})` : `(${teams.length})`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {orderedTeams.map((team, idx) => (
              <TeamCardRow key={`${team.player_name}-${idx}`} team={team} />
            ))}
            {Array.from({ length: Math.max(0, 18 - orderedTeams.length) }).map((_, idx) => (
              <div
                key={`empty-placeholder-${idx}`}
                className="flex flex-col justify-between gap-1.5 p-2 px-2.5 rounded-lg border border-dashed border-slate-800/40 bg-slate-900/10 opacity-30 w-full h-[65px] select-none pointer-events-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-500 font-mono">Time Vazio #{orderedTeams.length + idx + 1}</span>
                  <span className="text-[10px] text-slate-500 font-mono opacity-50 bg-slate-900/50 px-1.5 py-0.5 rounded">XXXX-XXXX</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-950/20">
                  <div className="flex gap-0.5 opacity-20">
                    {Array.from({ length: 6 }).map((_, pIdx) => (
                      <div key={pIdx} className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700/50"></div>
                    ))}
                  </div>
                  <span className="text-[9px] opacity-20">👁️</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COLUNA DIREITA: Criar Composição (Coluna Inteira) */}
        <section className="glass rounded-lg p-2.5 border-t-2 border-indigo-500 h-full min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-2 shrink-0">
            <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-1">🛠️ Criar Composição</h2>
            <div className="flex items-center gap-2">
              {selectedTeams.some(Boolean) && (
                <button
                  onClick={() => setSelectedTeams(['', '', '', ''])}
                  className="text-[9px] text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded transition-all cursor-pointer font-bold border border-slate-700/50"
                >
                  Limpar Tudo
                </button>
              )}
              {selectedComboTeams.length >= 2 && (
                <span className="text-[10px] text-emerald-450 bg-emerald-950/30 border border-emerald-900/50 px-2 py-0.5 rounded-full font-bold">
                  Custo Total: <strong className="font-extrabold">{comboTotalVp} VP</strong>
                </span>
              )}
            </div>
          </div>

          {/* Slots & Suggestions Scroll Container */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-3">
            {/* Slot 1 */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-slate-800 bg-slate-900/10 hover:border-slate-700/50 transition-all duration-300">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Slot #1 - Time Base</span>
                {selectedTeams[0] && (
                  <button 
                    onClick={() => clearSlot(0)}
                    className="text-[9px] text-red-400 hover:text-red-350 cursor-pointer font-bold px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30 hover:border-red-900/60 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
              {!selectedTeams[0] ? (
                <select
                  value=""
                  onChange={e => handleSlotChange(0, e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 w-full focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Selecione o Time Base...</option>
                  {slot1Options.map(t => (
                    <option key={t.player_name} value={t.player_name}>{t.player_name}</option>
                  ))}
                </select>
              ) : (
                (() => {
                  const team = activeTeams.find(t => t.player_name === selectedTeams[0]);
                  if (!team) return null;
                  return (
                    <div className="flex items-center justify-between gap-3 bg-indigo-950/20 p-2 rounded-lg border border-indigo-900/30">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-slate-200 text-xs truncate">{team.player_name}</span>
                        {team.rental_code && (
                          <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded select-all w-fit mt-1">
                            {team.rental_code}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {team.team.map((p, i) => (
                          <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} />
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Sugestões de Combinações de Slots 2 & 3 (Duplas Possíveis) */}
            {selectedTeams[0] && !selectedTeams[1] && !selectedTeams[2] && (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-indigo-900/35 bg-indigo-950/10 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ Combinações de Próximos 2 Times (Slot 2 & 3)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  </span>
                  <span className="text-[8px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold shrink-0">
                    {possiblePairsForSelectedTeam.length} {possiblePairsForSelectedTeam.length === 1 ? 'opção' : 'opções'}
                  </span>
                </div>
                {possiblePairsForSelectedTeam.length === 0 ? (
                  <div className="text-[10px] text-red-400 italic p-2 bg-red-950/10 border border-dashed border-red-900/30 rounded text-center">
                    Nenhum time compatível encontrado para fechar o trio com o Slot 1.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {possiblePairsForSelectedTeam.map((pair, idx) => {
                      const { teamA, teamB, totalVp } = pair;
                      const t1 = activeTeams.find(x => x.player_name === selectedTeams[0])!;
                      const combo = [t1, teamA, teamB].filter((x): x is TeamData => !!x);

                      return (
                        <div 
                          key={`${teamA.player_name}-${teamB ? teamB.player_name : 'null'}-${idx}`}
                          onClick={() => {
                            setSelectedTeams(prev => [prev[0], teamA.player_name, teamB ? teamB.player_name : '']);
                          }}
                          className="bg-slate-900/70 hover:bg-slate-850 border border-slate-800/80 hover:border-indigo-500/50 rounded-lg p-2 text-left transition-all cursor-pointer flex items-center justify-between gap-3 hover:scale-[1.01] active:scale-[0.99] duration-150 group"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-2 divide-x divide-slate-800/50">
                            {/* Team A (Slot 2) */}
                            <div className="flex items-center justify-between gap-2 min-w-0 pr-2">
                              <span className="font-bold text-xs text-slate-200 truncate">{teamA.player_name}</span>
                              <div className="flex gap-0.5 shrink-0">
                                {teamA.team.map((p, i) => (
                                  <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, teamA, combo)} />
                                ))}
                              </div>
                            </div>
                            {/* Team B (Slot 3) */}
                            {teamB ? (
                              <div className="flex items-center justify-between gap-2 min-w-0 pl-2">
                                <span className="font-bold text-xs text-slate-200 truncate">{teamB.player_name}</span>
                                <div className="flex gap-0.5 shrink-0">
                                  {teamB.team.map((p, i) => (
                                    <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, teamB, combo)} />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center min-w-0 pl-2">
                                <span className="text-[10px] text-slate-500 font-medium italic">Sem time adicional</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="shrink-0 flex flex-col items-end gap-1 pl-2 border-l border-slate-800/50">
                            <span className="text-[9px] text-emerald-450 bg-emerald-950/20 border border-emerald-900/30 px-1.5 py-0.2 rounded font-bold">
                              {totalVp} VP
                            </span>
                            <span className="text-[8px] text-indigo-400 group-hover:text-indigo-300 font-extrabold uppercase tracking-wider shrink-0 transition-colors">
                              Selecionar ➔
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Slot 2 */}
            {!selectedTeams[0] ? (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-dashed border-slate-800/40 bg-slate-900/5 opacity-50 select-none pointer-events-none">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Slot #2 - Segundo Time</span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-medium italic p-1">
                  Selecione o Time Base primeiro...
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-slate-800 bg-slate-900/10 hover:border-slate-700/50 transition-all duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Slot #2 - Segundo Time</span>
                  {selectedTeams[1] && (
                    <button 
                      onClick={() => clearSlot(1)}
                      className="text-[9px] text-red-400 hover:text-red-350 cursor-pointer font-bold px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30 hover:border-red-900/60 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
                {!selectedTeams[1] ? (
                  slot2Options.length === 0 ? (
                    <div className="text-center p-2 border border-dashed border-red-900/30 rounded bg-red-950/10 text-[10.5px] text-red-450">
                      Nenhum time compatível disponível para o Slot 2.
                    </div>
                  ) : (
                    <select
                      value=""
                      onChange={e => handleSlotChange(1, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 w-full focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">Selecione o Segundo Time...</option>
                      {slot2Options.map(t => (
                        <option key={t.player_name} value={t.player_name}>{t.player_name}</option>
                      ))}
                    </select>
                  )
                ) : (
                  (() => {
                    const team = activeTeams.find(t => t.player_name === selectedTeams[1]);
                    const team1 = activeTeams.find(t => t.player_name === selectedTeams[0]);
                    const team3 = activeTeams.find(t => t.player_name === selectedTeams[2]);
                    if (!team || !team1) return null;
                    const transitionCost1 = calculateTeamTransitionCost(team1, team, pokemonCopies).vpCost;
                    const transitionCost3 = team3 ? calculateTeamTransitionCost(team3, team, pokemonCopies).vpCost : null;
                    return (
                      <div className="flex items-center justify-between gap-3 bg-indigo-950/20 p-2 rounded-lg border border-indigo-900/30">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-200 text-xs truncate">{team.player_name}</span>
                            <span className="text-[9px] text-emerald-450 bg-emerald-950/30 border border-emerald-900/40 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              +{transitionCost1} VP (Slot 1)
                            </span>
                            {transitionCost3 !== null && (
                              <span className="text-[9px] text-emerald-450 bg-emerald-950/30 border border-emerald-900/40 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                +{transitionCost3} VP (Slot 3)
                              </span>
                            )}
                          </div>
                          {team.rental_code && (
                            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded select-all w-fit mt-1">
                              {team.rental_code}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {team.team.map((p, i) => (
                            <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} />
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Sugestões de Trios Possíveis para Slot 2 */}
            {selectedTeams[0] && !selectedTeams[1] && selectedTeams[2] && (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-indigo-900/35 bg-indigo-950/10 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ Trios Possíveis (Compatíveis com Slot 1 e 3)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-405"></span>
                  </span>
                  <span className="text-[8px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono shrink-0">
                    {nonIsolatedSlot2Options.length} {nonIsolatedSlot2Options.length === 1 ? 'time' : 'times'}
                  </span>
                </div>
                {nonIsolatedSlot2Options.length === 0 ? (
                  <div className="text-[10px] text-red-400 italic p-2 bg-red-950/10 border border-dashed border-red-900/30 rounded text-center">
                    Nenhum time compatível com ambos os selecionados para o Slot 2.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                    {nonIsolatedSlot2Options.map(t => {
                      const t1 = activeTeams.find(x => x.player_name === selectedTeams[0])!;
                      const t3 = activeTeams.find(x => x.player_name === selectedTeams[2])!;
                      const cost1 = calculateTeamTransitionCost(t1, t, pokemonCopies).vpCost;
                      const cost3 = calculateTeamTransitionCost(t3, t, pokemonCopies).vpCost;
                      const estimatedTotal = calculateComboTotalVp([t1, t, t3], pokemonCopies);
                      
                      const combo = [t1, t, t3].filter((x): x is TeamData => !!x);

                      return (
                        <button
                          type="button"
                          key={t.player_name}
                          onClick={() => handleSlotChange(1, t.player_name)}
                          className="bg-slate-900/70 hover:bg-slate-855 border border-slate-800/80 hover:border-indigo-500/50 rounded-lg p-2 text-left transition-all shrink-0 cursor-pointer flex flex-col gap-1 w-52 hover:scale-[1.02] active:scale-95 duration-200"
                        >
                          <span className="font-bold text-xs text-slate-200 truncate block w-full">{t.player_name}</span>
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[9px] text-purple-400 bg-purple-950/30 border border-purple-900/40 px-1.5 py-0.2 rounded font-bold shrink-0">
                              {estimatedTotal} VP
                            </span>
                            <div className="flex gap-0.5 shrink-0 opacity-80">
                              {t.team.map((p, i) => (
                                <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, t, combo)} />
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-medium border-t border-slate-800/40 pt-1 mt-0.5">
                            <span>S1: +{cost1} VP</span>
                            <span>S3: +{cost3} VP</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sugestões de Trios Possíveis para Slot 3 */}
            {selectedTeams[0] && selectedTeams[1] && !selectedTeams[2] && (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-indigo-900/35 bg-indigo-950/10 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ Trios Possíveis (Compatíveis com Slot 1 e 2)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-405"></span>
                  </span>
                  <span className="text-[8px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono shrink-0">
                    {nonIsolatedSlot3Options.length} {nonIsolatedSlot3Options.length === 1 ? 'time' : 'times'}
                  </span>
                </div>
                {nonIsolatedSlot3Options.length === 0 ? (
                  <div className="text-[10px] text-red-400 italic p-2 bg-red-950/10 border border-dashed border-red-900/30 rounded text-center">
                    Nenhum time compatível com ambos os selecionados para o Slot 3.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                    {nonIsolatedSlot3Options.map(t => {
                      const t1 = activeTeams.find(x => x.player_name === selectedTeams[0])!;
                      const t2 = activeTeams.find(x => x.player_name === selectedTeams[1])!;
                      const cost1 = calculateTeamTransitionCost(t1, t, pokemonCopies).vpCost;
                      const cost2 = calculateTeamTransitionCost(t2, t, pokemonCopies).vpCost;
                      const estimatedTotal = calculateComboTotalVp([t1, t2, t], pokemonCopies);
                      
                      const combo = [t1, t2, t].filter((x): x is TeamData => !!x);

                      return (
                        <button
                          type="button"
                          key={t.player_name}
                          onClick={() => handleSlotChange(2, t.player_name)}
                          className="bg-slate-900/70 hover:bg-slate-855 border border-slate-800/80 hover:border-indigo-500/50 rounded-lg p-2 text-left transition-all shrink-0 cursor-pointer flex flex-col gap-1 w-52 hover:scale-[1.02] active:scale-95 duration-200"
                        >
                          <span className="font-bold text-xs text-slate-200 truncate block w-full">{t.player_name}</span>
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[9px] text-purple-400 bg-purple-950/30 border border-purple-900/40 px-1.5 py-0.2 rounded font-bold shrink-0">
                              {estimatedTotal} VP
                            </span>
                            <div className="flex gap-0.5 shrink-0 opacity-80">
                              {t.team.map((p, i) => (
                                <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, t, combo)} />
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-medium border-t border-slate-800/40 pt-1 mt-0.5">
                            <span>S1: +{cost1} VP</span>
                            <span>S2: +{cost2} VP</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Slot 3 */}
            {!selectedTeams[0] ? (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-dashed border-slate-800/40 bg-slate-900/5 opacity-50 select-none pointer-events-none">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Slot #3 - Terceiro Time</span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-medium italic p-1">
                  Selecione o Time Base primeiro...
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-slate-800 bg-slate-900/10 hover:border-slate-700/50 transition-all duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Slot #3 - Terceiro Time</span>
                  {selectedTeams[2] && (
                    <button 
                      onClick={() => clearSlot(2)}
                      className="text-[9px] text-red-400 hover:text-red-350 cursor-pointer font-bold px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30 hover:border-red-900/60 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
                {!selectedTeams[2] ? (
                  slot3Options.length === 0 ? (
                    <div className="text-center p-2 border border-dashed border-red-900/30 rounded bg-red-950/10 text-[10.5px] text-red-450">
                      Nenhum time compatível disponível para o Slot 3.
                    </div>
                  ) : (
                    <select
                      value=""
                      onChange={e => handleSlotChange(2, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-350 w-full focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">Selecione o Terceiro Time...</option>
                      {slot3Options.map(t => (
                        <option key={t.player_name} value={t.player_name}>{t.player_name}</option>
                      ))}
                    </select>
                  )
                ) : (
                  (() => {
                    const team = activeTeams.find(t => t.player_name === selectedTeams[2]);
                    const team1 = activeTeams.find(t => t.player_name === selectedTeams[0]);
                    const team2 = activeTeams.find(t => t.player_name === selectedTeams[1]);
                    if (!team || !team1) return null;
                    const transitionCost1 = calculateTeamTransitionCost(team1, team, pokemonCopies).vpCost;
                    const transitionCost2 = team2 ? calculateTeamTransitionCost(team2, team, pokemonCopies).vpCost : null;
                    return (
                      <div className="flex items-center justify-between gap-3 bg-indigo-950/20 p-2 rounded-lg border border-indigo-900/30">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-200 text-xs truncate">{team.player_name}</span>
                            <span className="text-[9px] text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.2 rounded shrink-0">
                              +{transitionCost1} VP (Slot 1)
                            </span>
                            {transitionCost2 !== null && (
                              <span className="text-[9px] text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.2 rounded shrink-0">
                                +{transitionCost2} VP (Slot 2)
                              </span>
                            )}
                          </div>
                          {team.rental_code && (
                            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-900/30 px-1.5 py-0.5 rounded select-all w-fit mt-1">
                              {team.rental_code}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {team.team.map((p, i) => (
                            <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} />
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Times Reservas Possíveis (Troca Custo Zero) */}
            {selectedTeams[0] && selectedTeams[1] && selectedTeams[2] && (
              <div className="flex flex-col gap-1.5 p-2 rounded-xl border border-emerald-900/35 bg-emerald-950/10 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-emerald-450 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔄 Times Reservas Possíveis (Troca Custo Zero)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-450"></span>
                  </span>
                  <span className="text-[8px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono shrink-0">
                    {possibleFourthTeams.length} {possibleFourthTeams.length === 1 ? 'time' : 'times'}
                  </span>
                </div>
                {possibleFourthTeams.length === 0 ? (
                  <div className="text-[10px] text-slate-500 italic p-2 bg-slate-950/20 border border-dashed border-slate-800/40 rounded text-center">
                    Nenhum time da reserva pode substituir os slots ativos com custo de 0 VP.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                    {possibleFourthTeams.map((item, idx) => {
                      return (
                        <div 
                          key={`${item.team.player_name}-${idx}`}
                          className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2 text-left flex flex-col gap-1 w-52 shrink-0 select-none"
                        >
                          <span className="font-bold text-xs text-slate-200 truncate block w-full">{item.team.player_name}</span>
                          <div className="flex items-center justify-between gap-1 w-full">
                            <div className="flex gap-0.5 shrink-0 opacity-80">
                              {item.team.team.map((p, i) => (
                                <PokemonIcon key={i} poke={p} />
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1 border-t border-slate-800/40 pt-1 mt-0.5">
                            <span className="text-[8.5px] text-slate-500 uppercase font-bold">Trocas Possíveis:</span>
                            <div className="flex flex-wrap gap-1">
                              {item.replacements.map(r => (
                                <span key={r.slotIndex} className="text-[8.5px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5">
                                  S{r.slotIndex}: {r.newTotalVp} VP
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </section>
      </div>

      {/* Modal Adicionar Time */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative glass w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Importar Time</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">x</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[240px_220px_1fr] gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome do Jogador</label>
                  <input value={newTeamName} onChange={e => {
                    setNewTeamName(e.target.value);
                    if (pasteError) setPasteError('');
                  }} placeholder="Ex: Wolfe Glick"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rental Code</label>
                  <input value={newRentalCode} onChange={e => setNewRentalCode(e.target.value.toUpperCase())} placeholder="Ex: H7HM18T977"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-end">
                  <span className={"text-xs font-bold px-2 py-1 rounded border " + (parsedPasteTeam.length === 6 ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/60" : "text-slate-400 bg-slate-950 border-slate-800")}>
                    {parsedPasteTeam.length}/6 Pokemon lidos
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-4">
                <div className="flex flex-col gap-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase">Pokepaste</label>
                  <textarea
                    value={pasteInput}
                    onChange={e => {
                      setPasteInput(e.target.value);
                      if (pasteError) setPasteError('');
                    }}
                    placeholder={"Aerodactyl @ Aerodactylite\nAbility: Unnerve\nLevel: 50\nEVs: 12 HP / 12 Atk / 9 Def / 1 SpD / 32 Spe\nJolly Nature\n- Rock Slide\n- Dual Wingbeat\n- Tailwind\n- Protect"}
                    className="min-h-107.5 w-full resize-y bg-slate-950 border border-slate-800 rounded px-3 py-2 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none focus:border-blue-500 custom-scrollbar"
                  />
                  {pasteError && <p className="text-xs text-red-400">{pasteError}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Preview</span>
                    <span className="text-[10px] text-slate-500">Item, habilidade, nature, EVs e golpes</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-107.5 overflow-y-auto pr-1 custom-scrollbar">
                    {parsedPasteTeam.length === 0 ? (
                      <div className="sm:col-span-2 bg-slate-950/50 border border-dashed border-slate-800 rounded p-6 text-center text-sm text-slate-500">
                        Cole o texto do Pokepaste para ver o preview.
                      </div>
                    ) : (
                      parsedPasteTeam.map((p, idx) => (
                        <div key={p.name + "-" + idx} className="bg-slate-900/35 border border-slate-800 rounded p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <img src={getPokeIcon(p.name)} alt={p.name} className="w-8 h-8 object-contain shrink-0" onError={(e) => (e.currentTarget.src = "https://r2.limitlesstcg.net/pokemon/gen9/unown.png")} />
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-100 truncate">{p.name}</div>
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
                                <div className="text-[9px] text-slate-300 font-mono">{p.evs[stat]}</div>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {p.moves.map((move, midx) => (
                              <span key={midx} className="bg-slate-950/50 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-300 truncate">
                                {move || "Vazio"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button onClick={() => setShowAddModal(false)} className="text-xs text-slate-400 hover:text-white px-4">Cancelar</button>
                <button onClick={saveNewTeam} disabled={isSavingTeam} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-bold px-6 py-2 rounded transition-all">
                  {isSavingTeam ? 'Salvando...' : 'Importar Time'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Frequência & Ignorar */}
      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAnalysisModal(false)}></div>
          <div className="relative glass w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-blue-400">📊 Frequência & Cópias</h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ajuste o número de <strong>Cópias</strong> se você possui múltiplas cópias físicas do mesmo Pokémon (por exemplo, possuir 2 cópias permite usar 2 builds diferentes dele no mesmo trio sem custo de transição).
                </p>
              </div>
              <button onClick={() => setShowAnalysisModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pokemonFrequencies.map(({ name, count, variations }) => {
                const copies = pokemonCopies[name] || 1;
                return (
                  <div key={name} className={`flex items-center justify-between p-2 rounded border transition-all ${copies > 1 ? 'bg-blue-950/40 border-blue-500/50' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/80'}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <img src={getPokeIcon(name)} alt={name} className="w-6 h-6 object-contain shrink-0" onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] text-slate-200 truncate">{name}</span>
                        <span className="text-[9px] text-slate-500 whitespace-nowrap">
                          {count} {count === 1 ? 'vez' : 'vezes'} • {variations} {variations === 1 ? 'variação' : 'variações'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950/45 p-1 px-2.5 rounded-lg border border-slate-800/60 shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">Cópias:</span>
                      <button type="button" onClick={() => {
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
                      }} className="w-4 h-4 flex items-center justify-center bg-slate-800 text-[10px] text-slate-355 rounded hover:bg-slate-700 cursor-pointer">-</button>
                      <span className={`text-[10px] font-mono font-bold w-3 text-center ${copies > 1 ? 'text-blue-400 font-extrabold' : 'text-slate-450'}`}>{copies}</span>
                      <button type="button" onClick={() => {
                        const current = pokemonCopies[name] || 1;
                        setPokemonCopies(prev => ({
                          ...prev,
                          [name]: current + 1
                        }));
                      }} className="w-4 h-4 flex items-center justify-center bg-slate-800 text-[10px] text-slate-355 rounded hover:bg-slate-700 cursor-pointer">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4 shrink-0">
              <button onClick={() => setShowAnalysisModal(false)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2 rounded-lg transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Comparador de Times */}
      {showAverageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAverageModal(false)}></div>
          <div className="relative glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-cyan-400">Média contra a Base</h2>
                <p className="text-[11px] text-slate-400 mt-1">Calcula a média de VP de cada Pokémon contra todos os outros times, excluindo os dois selecionados da base.</p>
              </div>
              <button onClick={() => setShowAverageModal(false)} className="text-slate-400 hover:text-white">x</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Time 1</label>
                <select value={averageTeamA} onChange={e => setAverageTeamA(e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200">
                  <option value="">Selecione um time...</option>
                  {activeTeams.map(t => <option key={t.player_name} value={t.player_name} disabled={t.player_name === averageTeamB}>{t.player_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Time 2</label>
                <select value={averageTeamB} onChange={e => setAverageTeamB(e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200">
                  <option value="">Selecione um time...</option>
                  {activeTeams.map(t => <option key={t.player_name} value={t.player_name} disabled={t.player_name === averageTeamA}>{t.player_name}</option>)}
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
                        {result.team.rental_code && <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/30 px-1 rounded">{result.team.rental_code}</span>}
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
                            <img src={getPokeIcon(item.pokemon)} alt={item.pokemon} className="w-6 h-6 object-contain shrink-0" onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} />
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
      )}

      {/* Modal Comparador de Times */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCompareModal(false)}></div>
          <div className="relative glass w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-pink-400">⚖️ Análise Comparativa por Pokémon</h2>
                <p className="text-[11px] text-slate-400 mt-1">Escolha um Pokémon repetido e compare suas builds em todos os times em que ele aparece.</p>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-white">✕</button>
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
              (() => {
                const builds = teamsWithComparePokemon.map(t => {
                  const poke = t.team.find(p => p.name === activeComparePokemon)!;
                  return { team: t, poke };
                });
                const refBuild = builds.find(b => b.team.player_name === activeReferenceTeam);

                return (
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
                );
              })()
            ) : (
              <div className="flex-1 bg-slate-950/50 border border-dashed border-slate-800 rounded p-8 flex flex-col items-center justify-center text-slate-500 text-sm">
                <span>Nenhum Pokémon selecionado. Escolha um Pokémon no menu acima para começar.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Visualizar Time Completo */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewingTeam(null)}></div>
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
              <button onClick={() => setViewingTeam(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 overflow-y-auto pr-1 custom-scrollbar">
              {/* Pokémon cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {viewingTeam.team.map((p, idx) => (
                  <div key={p.name + "-" + idx} className="bg-slate-900/35 border border-slate-800 rounded p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <img src={getPokeIcon(p.name)} alt={p.name} className="w-8 h-8 object-contain shrink-0" onError={(e) => (e.currentTarget.src = "https://r2.limitlesstcg.net/pokemon/gen9/unown.png")} />
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
              <button onClick={() => setViewingTeam(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-6 py-2 rounded-lg transition-all cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTooltip && (() => {
        const { name, nature, sharingMode, x, y } = activeTooltip;
        return (
          <div 
            className="fixed z-[9999] bg-slate-900 text-[9px] px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap text-slate-200 pointer-events-none -translate-x-1/2 -translate-y-full mb-1"
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}
          >
            {name || '???'} {nature && <span className="text-blue-300">({displayNatureName(nature)})</span>}
            {sharingMode === 'identical' && <span className="ml-1 text-emerald-400 font-bold">(Idêntico)</span>}
            {sharingMode === 'copy' && <span className="ml-1 text-amber-500 font-bold">(Cópia)</span>}
          </div>
        );
      })()}
    </div>
  )
}

export default App
