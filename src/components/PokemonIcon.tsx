import React, { useEffect } from 'react';
import { getPokeIcon, displayNatureName } from '../utils';

interface PokemonIconProps {
  poke: { name: string; nature?: string };
  sharingMode?: 'identical' | 'copy' | null;
  setActiveTooltip: React.Dispatch<React.SetStateAction<{
    name: string;
    nature?: string;
    sharingMode?: 'identical' | 'copy' | null;
    x: number;
    y: number;
  } | null>>;
}

const PokemonIcon = React.memo(({ 
  poke, 
  sharingMode,
  setActiveTooltip
}: PokemonIconProps) => {
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

  useEffect(() => {
    return () => {
      setActiveTooltip(current => {
        if (
          current &&
          current.name === poke.name &&
          current.nature === poke.nature &&
          current.sharingMode === sharingMode
        ) {
          return null;
        }
        return current;
      });
    };
  }, [poke.name, poke.nature, sharingMode, setActiveTooltip]);

  return (
    <div 
      className={`relative group/icon ${ringClass}`} 
      title={poke.nature ? `${poke.name} (${displayNatureName(poke.nature)})` : poke.name}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img 
        src={getPokeIcon(poke.name)} 
        alt={poke.name} 
        className="w-6 h-6 object-contain filter drop-shadow-md pointer-events-none"
        onError={(e) => (e.currentTarget.src = 'https://r2.limitlesstcg.net/pokemon/gen9/unown.png')} 
      />
    </div>
  );
});

PokemonIcon.displayName = 'PokemonIcon';

export default PokemonIcon;
