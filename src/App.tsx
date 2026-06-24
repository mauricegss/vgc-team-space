import { useState, useMemo, useEffect } from 'react';
import rawData from '../dados-completos.json';
import type { TeamData, Pokemon } from './types';
import { findIsolatedTeams, calculateTeamTransitionCost, parsePokepaste, displayNatureName, calculateAverageBaseCosts, countPokemonVariations, calculateComboTotalVp, areTeamsCompatible, getPokemonSharingMode } from './utils';

// Import refactored components
import PokemonIcon from './components/PokemonIcon';
import TeamCardRow from './components/TeamCardRow';
import AddTeamModal from './components/AddTeamModal';
import FrequencyModal from './components/FrequencyModal';
import AverageBaseCostsModal from './components/AverageBaseCostsModal';
import CompareTeamsModal from './components/CompareTeamsModal';
import ViewTeamModal from './components/ViewTeamModal';



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
      const custom = JSON.parse(localStorage.getItem('vgc_custom_teams') || '[]');
      const deleted = JSON.parse(localStorage.getItem('vgc_deleted_teams') || '[]');
      
      let combined = [...initialData, ...custom];
      // Deduplicate by player_name (custom teams override initial teams with same name)
      const uniqueTeamsMap = new Map<string, TeamData>();
      combined.forEach(t => {
        uniqueTeamsMap.set(t.player_name, t);
      });
      combined = Array.from(uniqueTeamsMap.values());

      if (deleted.length > 0) {
        return combined.filter(t => !deleted.includes(t.player_name));
      }
      return combined;
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
    // Clean up deprecated storage keys but keep vgc_custom_teams
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


  const deleteTeam = async (playerName: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir permanentemente o time de "${playerName}"?`)) {
      return;
    }
    const nextTeams = teams.filter(t => t.player_name !== playerName);

    // Save to deleted list in localStorage
    try {
      const deleted = JSON.parse(localStorage.getItem('vgc_deleted_teams') || '[]');
      if (!deleted.includes(playerName)) {
        deleted.push(playerName);
        localStorage.setItem('vgc_deleted_teams', JSON.stringify(deleted));
      }
      
      // Also remove from custom teams if it was there
      const custom = JSON.parse(localStorage.getItem('vgc_custom_teams') || '[]');
      const filteredCustom = custom.filter((t: TeamData) => t.player_name !== playerName);
      localStorage.setItem('vgc_custom_teams', JSON.stringify(filteredCustom));
    } catch (e) {
      console.error("Erro ao salvar exclusão no LocalStorage:", e);
    }

    setTeams(nextTeams);
    setViewingTeam(null);
    setSelectedTeams(prev => prev.map(name => name === playerName ? '' : name));
    if (teamA === playerName) setTeamA('');
    if (teamB === playerName) setTeamB('');
    if (averageTeamA === playerName) setAverageTeamA('');
    if (averageTeamB === playerName) setAverageTeamB('');

    try {
      await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTeamsForJson(nextTeams)),
      });
    } catch {
      console.warn('Não foi possível sincronizar a exclusão com o servidor. A alteração foi salva localmente no navegador.');
    }
  };

  const handleSaveTeam = async (playerName: string, pasteText: string, rentalCode: string): Promise<string | null> => {
    const parsedTeam = parsePokepaste(pasteText);
    if (parsedTeam.length !== 6) {
      return `Cole um Pokepaste com 6 Pokemon. Encontrei ${parsedTeam.length}.`;
    }

    const newTeam: TeamData = {
      player_name: playerName,
      team: parsedTeam,
    };
    if (rentalCode.trim()) {
      newTeam.rental_code = rentalCode.trim();
    }
    const nextTeams = [...teams, newTeam];

    // Save to custom teams in localStorage
    try {
      const custom = JSON.parse(localStorage.getItem('vgc_custom_teams') || '[]');
      // Avoid duplicate names in custom
      const filteredCustom = custom.filter((t: TeamData) => t.player_name !== playerName);
      filteredCustom.push(newTeam);
      localStorage.setItem('vgc_custom_teams', JSON.stringify(filteredCustom));
      
      // If it was deleted before, undelete it
      const deleted = JSON.parse(localStorage.getItem('vgc_deleted_teams') || '[]');
      const filteredDeleted = deleted.filter((name: string) => name !== playerName);
      localStorage.setItem('vgc_deleted_teams', JSON.stringify(filteredDeleted));
    } catch (e) {
      console.error("Erro ao salvar time no LocalStorage:", e);
    }

    setTeams(nextTeams);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTeamsForJson(nextTeams)),
      });
      if (!response.ok) {
        throw new Error('Nao foi possivel escrever o dados-completos.json.');
      }
    } catch {
      console.warn('Não foi possível sincronizar o novo time com o servidor. O time foi salvo localmente no seu navegador.');
    }

    return null; // success
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


  const averageAnalysisData = useMemo(() => {
    const selected = [averageTeamA, averageTeamB].filter(Boolean);
    if (!showAverageModal || selected.length === 0) return [];
    return calculateAverageBaseCosts(activeTeams, selected, pokemonCopies);
  }, [activeTeams, averageTeamA, averageTeamB, showAverageModal, pokemonCopies]);

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
              <TeamCardRow 
                key={`${team.player_name}-${idx}`} 
                team={team} 
                isExcluded={excludedTeamNames.includes(team.player_name)}
                isIsolated={isolatedTeams.some(iso => iso.player_name === team.player_name)}
                toggleExcludeTeam={toggleExcludeTeam}
                setViewingTeam={setViewingTeam}
                setActiveTooltip={setActiveTooltip}
              />
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
                          <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} setActiveTooltip={setActiveTooltip} />
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
                                  <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, teamA, combo)} setActiveTooltip={setActiveTooltip} />
                                ))}
                              </div>
                            </div>
                            {/* Team B (Slot 3) */}
                            {teamB ? (
                              <div className="flex items-center justify-between gap-2 min-w-0 pl-2">
                                <span className="font-bold text-xs text-slate-200 truncate">{teamB.player_name}</span>
                                <div className="flex gap-0.5 shrink-0">
                                  {teamB.team.map((p, i) => (
                                    <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, teamB, combo)} setActiveTooltip={setActiveTooltip} />
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
                            <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} setActiveTooltip={setActiveTooltip} />
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
                                <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, t, combo)} setActiveTooltip={setActiveTooltip} />
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
                                <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, t, combo)} setActiveTooltip={setActiveTooltip} />
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
                            <PokemonIcon key={i} poke={p} sharingMode={getPokemonSharingMode(p, team, selectedComboTeams)} setActiveTooltip={setActiveTooltip} />
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
                                <PokemonIcon key={i} poke={p} setActiveTooltip={setActiveTooltip} />
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

      <AddTeamModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSave={handleSaveTeam} 
      />

      <FrequencyModal 
        isOpen={showAnalysisModal} 
        onClose={() => setShowAnalysisModal(false)} 
        pokemonFrequencies={pokemonFrequencies} 
        pokemonCopies={pokemonCopies} 
        setPokemonCopies={setPokemonCopies} 
      />

      <AverageBaseCostsModal 
        isOpen={showAverageModal} 
        onClose={() => setShowAverageModal(false)} 
        activeTeams={activeTeams} 
        averageTeamA={averageTeamA} 
        averageTeamB={averageTeamB} 
        setAverageTeamA={setAverageTeamA} 
        setAverageTeamB={setAverageTeamB} 
        averageAnalysisData={averageAnalysisData} 
      />

      <CompareTeamsModal 
        isOpen={showCompareModal} 
        onClose={() => setShowCompareModal(false)} 
        activeTeams={activeTeams} 
        pokemonFrequencies={pokemonFrequencies} 
        comparePokemon={comparePokemon} 
        setComparePokemon={setComparePokemon} 
        compareReferenceTeam={compareReferenceTeam} 
        setCompareReferenceTeam={setCompareReferenceTeam} 
      />

      <ViewTeamModal 
        viewingTeam={viewingTeam} 
        onClose={() => setViewingTeam(null)} 
        deleteTeam={deleteTeam} 
      />

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
