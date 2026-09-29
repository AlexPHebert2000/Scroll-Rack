import React from 'react';
import Box from '@mui/material/Box';

interface Props {
  cost: string;
  size?: number;
}

const ManaSymbols = ({ cost, size = 14 }: Props) => {
  const tokens = [...cost.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  if (tokens.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
      {tokens.map((t, i) => (
        <img
          key={i}
          src={`https://svgs.scryfall.io/card-symbols/${t.replace('/', '')}.svg`}
          alt={`{${t}}`}
          width={size}
          height={size}
          style={{ display: 'block' }}
        />
      ))}
    </Box>
  );
};

export default ManaSymbols;
