import type { Pokemon, TeamData, CoreGroup } from './types';

export const NATURES = [
    { name: 'Adamant', increases: 'Attack', decreases: 'Sp. Atk', key: '+atk -spa' },
    { name: 'Bashful', increases: 'Sp. Atk', decreases: 'Sp. Atk', key: '+spa -spa' },
    { name: 'Bold', increases: 'Defense', decreases: 'Attack', key: '+def -atk' },
    { name: 'Brave', increases: 'Attack', decreases: 'Speed', key: '+atk -spe' },
    { name: 'Calm', increases: 'Sp. Def', decreases: 'Attack', key: '+spd -atk' },
    { name: 'Careful', increases: 'Sp. Def', decreases: 'Sp. Atk', key: '+spd -spa' },
    { name: 'Docile', increases: 'Defense', decreases: 'Defense', key: '+def -def' },
    { name: 'Gentle', increases: 'Sp. Def', decreases: 'Defense', key: '+spd -def' },
    { name: 'Hardy', increases: 'Attack', decreases: 'Attack', key: '+atk -atk' },
    { name: 'Hasty', increases: 'Speed', decreases: 'Defense', key: '+spe -def' },
    { name: 'Impish', increases: 'Defense', decreases: 'Sp. Atk', key: '+def -spa' },
    { name: 'Jolly', increases: 'Speed', decreases: 'Sp. Atk', key: '+spe -spa' },
    { name: 'Lax', increases: 'Defense', decreases: 'Sp. Def', key: '+def -spd' },
    { name: 'Lonely', increases: 'Attack', decreases: 'Defense', key: '+atk -def' },
    { name: 'Mild', increases: 'Sp. Atk', decreases: 'Defense', key: '+spa -def' },
    { name: 'Modest', increases: 'Sp. Atk', decreases: 'Attack', key: '+spa -atk' },
    { name: 'Naive', increases: 'Speed', decreases: 'Sp. Def', key: '+spe -spd' },
    { name: 'Naughty', increases: 'Attack', decreases: 'Sp. Def', key: '+atk -spd' },
    { name: 'Quiet', increases: 'Sp. Atk', decreases: 'Speed', key: '+spa -spe' },
    { name: 'Quirky', increases: 'Sp. Def', decreases: 'Sp. Def', key: '+spd -spd' },
    { name: 'Rash', increases: 'Sp. Atk', decreases: 'Sp. Def', key: '+spa -spd' },
    { name: 'Relaxed', increases: 'Defense', decreases: 'Speed', key: '+def -spe' },
    { name: 'Sassy', increases: 'Sp. Def', decreases: 'Speed', key: '+spd -spe' },
    { name: 'Serious', increases: 'Speed', decreases: 'Speed', key: '+spe -spe' },
    { name: 'Timid', increases: 'Speed', decreases: 'Attack', key: '+spe -atk' },
];

const normalizeModifierKey = (nature?: string): string => {
    if (!nature) return '';
    return nature.toLowerCase().trim().split(/\s+/).sort().join(' ');
};

const natureByName = new Map(NATURES.map(n => [n.name.toLowerCase(), n]));
const natureByKey = new Map(NATURES.map(n => [normalizeModifierKey(n.key), n]));

export const normalizeNatureName = (nature?: string): string => {
    if (!nature) return '';
    const byName = natureByName.get(nature.toLowerCase().trim());
    if (byName) return byName.name;

    const byKey = natureByKey.get(normalizeModifierKey(nature));
    return byKey?.name || nature.trim();
};

export const displayNatureName = (nature?: string): string => {
    return normalizeNatureName(nature) || 'Neutro';
};

const emptyStats = () => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

const statAliases: Record<string, keyof Pokemon['evs']> = {
    hp: 'hp',
    atk: 'atk',
    attack: 'atk',
    def: 'def',
    defense: 'def',
    spa: 'spa',
    spatk: 'spa',
    'sp.atk': 'spa',
    'sp atk': 'spa',
    spd: 'spd',
    spdef: 'spd',
    'sp.def': 'spd',
    'sp def': 'spd',
    spe: 'spe',
    speed: 'spe',
};

const parseEvLine = (line: string): Pokemon['evs'] => {
    const evs = emptyStats();
    const evText = line.replace(/^EVs:\s*/i, '');
    evText.split('/').forEach(part => {
        const match = part.trim().match(/^(\d+)\s+(.+)$/);
        if (!match) return;
        const value = Number(match[1]);
        const statKey = statAliases[match[2].toLowerCase().replace(/\s+/g, ' ').trim()];
        if (statKey) evs[statKey] = value;
    });
    return evs;
};

const normalizePokemonName = (name: string): string => {
    return name.replace(/\s+\((M|F)\)$/i, '').trim();
};

export const parsePokepaste = (input: string): Pokemon[] => {
    return input
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean)
        .map(block => {
            const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
            const header = lines[0] || '';
            const [rawName, ...itemParts] = header.split('@');
            const pokemon: Pokemon = {
                name: normalizePokemonName(rawName.trim()),
                item: itemParts.join('@').trim(),
                ability: '',
                moves: [],
                evs: emptyStats(),
                nature: '',
            };

            lines.slice(1).forEach(line => {
                if (/^Ability:/i.test(line)) {
                    pokemon.ability = line.replace(/^Ability:\s*/i, '').trim();
                } else if (/^EVs:/i.test(line)) {
                    pokemon.evs = parseEvLine(line);
                } else if (/ Nature$/i.test(line)) {
                    pokemon.nature = normalizeNatureName(line.replace(/\s+Nature$/i, '').trim());
                } else if (line.startsWith('-')) {
                    pokemon.moves.push(line.replace(/^-\s*/, '').trim());
                }
            });

            pokemon.moves = pokemon.moves.slice(0, 4);
            while (pokemon.moves.length < 4) pokemon.moves.push('');
            return pokemon;
        })
        .filter(pokemon => pokemon.name)
        .slice(0, 6);
};

// VP Cost Calculator for transitioning from Source to Target
export const calculatePokemonTransitionCost = (source: Pokemon, target: Pokemon): number => {
    let cost = 0;

    if (source.ability !== target.ability) cost += 500; // Trocar Habilidade

    if (normalizeNatureName(source.nature) !== normalizeNatureName(target.nature)) cost += 500; // Trocar Nature

    const sourceMoves = source.moves.filter(Boolean);
    const targetMoves = target.moves.filter(Boolean);
    const movesToLearn = targetMoves.filter(m => !sourceMoves.includes(m));
    cost += movesToLearn.length * 250; // Aprender novos golpes

    const stats: (keyof Pokemon['evs'])[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    for (const stat of stats) {
        if (target.evs[stat] > source.evs[stat]) {
            cost += (target.evs[stat] - source.evs[stat]) * 5; // Adicionar EVs
        }
    }
    return cost;
};

export const areBuildsCompatible = (p1: Pokemon, p2: Pokemon): boolean => {
    if (p1.name !== p2.name) return false;
    const cost1 = calculatePokemonTransitionCost(p1, p2);
    const cost2 = calculatePokemonTransitionCost(p2, p1);
    return cost1 <= 30 && cost2 <= 30;
};

// Check if two pokemon builds conflict (Strict check for Combinations)
export const doPokemonConflict = (p1: Pokemon, p2: Pokemon): boolean => {
    return !areBuildsCompatible(p1, p2);
};

export const countPokemonVariations = (builds: Pokemon[]): number => {
    if (builds.length === 0) return 0;

    const n = builds.length;
    const adj: number[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            // If transition in both directions is <= 30 VP, they are compatible variations
            if (areBuildsCompatible(builds[i], builds[j])) {
                adj[i].push(j);
                adj[j].push(i);
            }
        }
    }

    const visited = new Set<number>();
    let componentsCount = 0;

    for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
            componentsCount++;
            const queue = [i];
            visited.add(i);
            while (queue.length > 0) {
                const curr = queue.shift()!;
                for (const neighbor of adj[curr]) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }
    }

    return componentsCount;
};

export const calculateTeamTransitionCost = (source: TeamData, target: TeamData, pokemonCopies: Record<string, number> = {}) => {
    let vpCost = 0;
    let newPokemonCount = 0;
    let sharedPokemonCount = 0;

    target.team.forEach(targetPoke => {
        if (!targetPoke.name) {
            newPokemonCount += 1;
            return;
        }
        const sourcePoke = source.team.find(p => p.name === targetPoke.name);
        if (sourcePoke) {
            sharedPokemonCount += 1;
            const k = pokemonCopies[targetPoke.name] || 1;
            if (k === 1) {
                vpCost += calculatePokemonTransitionCost(sourcePoke, targetPoke);
            }
        } else {
            newPokemonCount += 1;
        }
    });

    return { vpCost, newPokemonCount, sharedPokemonCount };
};

export const calculateAverageBaseCosts = (teams: TeamData[], selectedTeamNames: string[], pokemonCopies: Record<string, number> = {}) => {
    const selectedTeams = selectedTeamNames
        .map(name => teams.find(team => team.player_name === name))
        .filter(Boolean) as TeamData[];

    const baseTeams = teams.filter(team => !selectedTeamNames.includes(team.player_name));

    return selectedTeams.map(team => {
        const pokemonBreakdown = team.team.map(sourcePokemon => {
            let total = 0;
            const k = pokemonCopies[sourcePokemon.name] || 1;
            if (k === 1) {
                total = baseTeams.reduce((sum, baseTeam) => {
                    const sameSpecies = baseTeam.team.find(targetPokemon => targetPokemon.name === sourcePokemon.name);
                    if (!sameSpecies) return sum;
                    return sum + calculatePokemonTransitionCost(sourcePokemon, sameSpecies);
                }, 0);
            }

            const averageCost = baseTeams.length > 0 ? total / baseTeams.length : 0;
            return {
                pokemon: sourcePokemon.name,
                averageCost: Math.round(averageCost * 100) / 100,
            };
        });

        return {
            team,
            pokemonBreakdown,
            teamTotal: Math.round(pokemonBreakdown.reduce((sum, item) => sum + item.averageCost, 0) * 100) / 100,
            baseTeamCount: baseTeams.length,
        };
    });
};


// Check if two teams are compatible (Cost up to 30 VP is allowed)
export const areTeamsCompatible = (t1: TeamData, t2: TeamData, pokemonCopies: Record<string, number> = {}): boolean => {
    const cost = calculateTeamTransitionCost(t1, t2, pokemonCopies);
    return cost.vpCost <= 30;
};

// Find pairs/trios of pokemon that appear together frequently (Cores)
export const findCores = (teams: TeamData[]): CoreGroup[] => {
    if (!Array.isArray(teams)) return [];
    const pairCounts: Record<string, TeamData[]> = {};

    teams.forEach(team => {
        if (!team.team) return;
        const names = team.team.map(p => p.name).filter(Boolean).sort();
        // Just look at pairs for simplicity of "cores"
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const pairKey = `${names[i]} + ${names[j]}`;
                if (!pairCounts[pairKey]) pairCounts[pairKey] = [];
                pairCounts[pairKey].push(team);
            }
        }
    });

    const cores: CoreGroup[] = [];
    Object.entries(pairCounts).forEach(([key, teamList]) => {
        // A core is valid if it appears in at least 2 different teams
        if (teamList.length >= 2) {
            cores.push({
                id: key,
                corePokemonNames: key.split(' + '),
                teams: Array.from(new Set(teamList)) // unique teams
            });
        }
    });

    // Sort cores by popularity
    return cores.sort((a, b) => b.teams.length - a.teams.length);
};

// Find isolated teams (teams that share ZERO pokemon with any other team, ignoring identical builds and species with enough copies)
export const findIsolatedTeams = (teams: TeamData[], pokemonCopies: Record<string, number> = {}): TeamData[] => {
    if (!Array.isArray(teams)) return [];

    // Group builds by species name to calculate variations
    const buildsMap = new Map<string, Pokemon[]>();
    teams.forEach(team => {
        if (!team.team) return;
        team.team.forEach(p => {
            if (p.name) {
                if (!buildsMap.has(p.name)) {
                    buildsMap.set(p.name, []);
                }
                buildsMap.get(p.name)!.push(p);
            }
        });
    });

    // Determine which species are constrained
    const constrainedSpecies = new Set<string>();
    buildsMap.forEach((builds, name) => {
        const k = pokemonCopies[name] || 1;
        const variations = countPokemonVariations(builds);
        if (variations > k) {
            constrainedSpecies.add(name);
        }
    });

    return teams.filter(t1 => {
        if (!t1.team) return false;
        return !teams.some(t2 => {
            if (!t2.team) return false;
            if (t1.player_name === t2.player_name) return false;
            // Does t1 share ANY constrained pokemon with t2 that conflicts?
            return t1.team.some(p1 => {
                if (!p1.name) return false;
                // If the species is not constrained (we have enough copies to cover all variations in active teams),
                // it cannot cause any conflict
                if (!constrainedSpecies.has(p1.name)) return false;

                return t2.team.some(p2 => p1.name === p2.name && doPokemonConflict(p1, p2));
            });
        });
    });
};

// Simple recursive function to find combinations of compatible teams
export const findCombinations = (teams: TeamData[], targetSize: number = 3, maxLimit: number = 50, pokemonCopies: Record<string, number> = {}): TeamData[][] => {
    if (!Array.isArray(teams)) return [];
    const validCombos: TeamData[][] = [];

    const search = (currentCombo: TeamData[], startIndex: number) => {
        if (validCombos.length >= maxLimit) return; // Stop if we found enough

        if (currentCombo.length === targetSize) {
            validCombos.push([...currentCombo]);
            return;
        }

        for (let i = startIndex; i < teams.length; i++) {
            if (validCombos.length >= maxLimit) return;
            const candidate = teams[i];
            if (!candidate.team) continue;

            // Check if adding candidate keeps the entire combo compatible (total VP cost <= 30)
            const isCompatible = calculateComboTotalVp([...currentCombo, candidate], pokemonCopies) <= 30;

            if (isCompatible) {
                currentCombo.push(candidate);
                search(currentCombo, i + 1);
                currentCombo.pop();
            }
        }
    };

    search([], 0);
    return validCombos;
};

export const getPokeIcon = (name: string) => {
    if (!name) return 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png';
    const sanitized = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `https://r2.limitlesstcg.net/pokemon/gen9/${sanitized}.png`;
};


export const calculateSpeciesTransitionCostInCombo = (builds: Pokemon[], k: number): number => {
    const m = builds.length;
    if (m <= 1) return 0;

    const effectiveK = Math.min(k, m);
    let minCost = Infinity;

    if (m === 2) {
        for (let a0 = 0; a0 < effectiveK; a0++) {
            for (let a1 = 0; a1 < effectiveK; a1++) {
                let cost = 0;
                if (a0 === a1) {
                    cost += calculatePokemonTransitionCost(builds[0], builds[1]);
                }
                if (cost < minCost) minCost = cost;
            }
        }
    } else if (m === 3) {
        for (let a0 = 0; a0 < effectiveK; a0++) {
            for (let a1 = 0; a1 < effectiveK; a1++) {
                for (let a2 = 0; a2 < effectiveK; a2++) {
                    let cost = 0;
                    if (a0 === a1) cost += calculatePokemonTransitionCost(builds[0], builds[1]);
                    if (a0 === a2) cost += calculatePokemonTransitionCost(builds[0], builds[2]);
                    if (a1 === a2) cost += calculatePokemonTransitionCost(builds[1], builds[2]);
                    if (cost < minCost) minCost = cost;
                }
            }
        }
    }

    return minCost === Infinity ? 0 : minCost;
};

export const calculateComboTotalVp = (
    combo: TeamData[],
    pokemonCopies: Record<string, number> = {}
): number => {
    let totalVp = 0;

    const allSpecies = new Set<string>();
    combo.forEach(team => {
        team.team.forEach(p => {
            if (p.name) {
                allSpecies.add(p.name);
            }
        });
    });

    allSpecies.forEach(speciesName => {
        const builds: Pokemon[] = [];
        combo.forEach(team => {
            const p = team.team.find(poke => poke.name === speciesName);
            if (p) builds.push(p);
        });

        const k = pokemonCopies[speciesName] || 1;
        totalVp += calculateSpeciesTransitionCostInCombo(builds, k);
    });

    return totalVp;
};

// Helper function to get the sharing status of a specific Pokemon build in a list of teams
export const getPokemonSharingMode = (
    poke: Pokemon,
    currentTeam: TeamData,
    combo: TeamData[]
): 'identical' | 'copy' | null => {
    if (!poke.name) return null;

    // Filter combo to other teams that contain this pokemon species
    const otherTeamsWithSpecies = combo.filter(t => 
        t.player_name !== currentTeam.player_name && 
        t.team.some(p => p.name === poke.name)
    );

    if (otherTeamsWithSpecies.length === 0) {
        return null; // Not shared in other teams
    }

    // Check if there is any other team that has an identical build
    const hasIdenticalBuild = otherTeamsWithSpecies.some(t => {
        const otherPoke = t.team.find(p => p.name === poke.name);
        return otherPoke && !doPokemonConflict(poke, otherPoke);
    });

    return hasIdenticalBuild ? 'identical' : 'copy';
};

export const exportToPokepaste = (teamData: TeamData): string => {
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




