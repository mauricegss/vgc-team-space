import { useState, useMemo } from 'react';
import { parsePokepaste, getPokeIcon, displayNatureName } from '../utils';

interface AddTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, paste: string, rentalCode: string) => Promise<string | null>;
}

const AddTeamModal = ({ isOpen, onClose, onSave }: AddTeamModalProps) => {
  const [newTeamName, setNewTeamName] = useState('');
  const [newRentalCode, setNewRentalCode] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  const parsedPasteTeam = useMemo(() => parsePokepaste(pasteInput), [pasteInput]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSavingTeam) return;
    const name = newTeamName.trim();
    if (!name) {
      setPasteError('Informe um nome para identificar o time.');
      return;
    }
    if (parsedPasteTeam.length !== 6) {
      setPasteError(`Cole um Pokepaste com 6 Pokemon. Encontrei ${parsedPasteTeam.length}.`);
      return;
    }

    setIsSavingTeam(true);
    setPasteError('');
    try {
      const errorMsg = await onSave(name, pasteInput, newRentalCode);
      if (errorMsg) {
        setPasteError(errorMsg);
      } else {
        // Reset states and close on success
        setNewTeamName('');
        setNewRentalCode('');
        setPasteInput('');
        onClose();
      }
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : 'Erro desconhecido ao salvar.');
    } finally {
      setIsSavingTeam(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative glass w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-5">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Importar Time</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">x</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[240px_220px_1fr] gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome do Jogador</label>
              <input 
                value={newTeamName} 
                onChange={e => {
                  setNewTeamName(e.target.value);
                  if (pasteError) setPasteError('');
                }} 
                placeholder="Ex: Wolfe Glick"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rental Code</label>
              <input 
                value={newRentalCode} 
                onChange={e => setNewRentalCode(e.target.value.toUpperCase())} 
                placeholder="Ex: H7HM18T977"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500" 
              />
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
                        <img 
                          src={getPokeIcon(p.name)} 
                          alt={p.name} 
                          className="w-8 h-8 object-contain shrink-0" 
                          onError={(e) => (e.currentTarget.src = "https://r2.limitlesstcg.net/pokemon/gen9/unown.png")} 
                        />
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
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-white px-4">Cancelar</button>
            <button 
              onClick={handleSave} 
              disabled={isSavingTeam} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-bold px-6 py-2 rounded transition-all"
            >
              {isSavingTeam ? 'Salvando...' : 'Importar Time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTeamModal;
