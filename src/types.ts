export interface Stats {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

export interface Pokemon {
    name: string;
    item: string;
    ability: string;
    moves: string[];
    evs: Stats;
    nature?: string;
}

export interface TeamData {
    player_name: string;
    team: Pokemon[];
    rental_code?: string;
}

export interface CoreGroup {
    id: string; // e.g. "Scovillain+Aerodactyl"
    corePokemonNames: string[];
    teams: TeamData[];
}
