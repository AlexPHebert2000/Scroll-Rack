import React from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import type { Card } from '../CardImage';
import { cardDisplayName } from '../CardImage';

interface Props {
  card: Card;
  effectiveCount: number;
  onAdd: () => void;
  onRemove: () => void;
}

const btnSx = {
  flexShrink: 0, width: 26, height: 26, borderRadius: '5px', cursor: 'pointer',
  backgroundColor: SR.surfaceCard, border: `0.5px solid ${SR.border}`,
  color: SR.textMuted, fontFamily: SR.fontMono, fontSize: 16, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 80ms, border-color 80ms',
  '&:hover': { borderColor: SR.textMuted, color: SR.textPrimary },
  '&:disabled': { opacity: 0.3, cursor: 'default' },
};

const SearchResult = ({ card, effectiveCount, onAdd, onRemove }: Props) => {
  const imgUrl = card.defaultArt?.faces?.[0]?.imageUrl ?? card.defaultArt?.imageUrl ?? null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '7px 12px', borderBottom: `0.5px solid ${SR.border}`,
      transition: 'background 80ms',
      '&:hover': { backgroundColor: SR.surfaceCard },
    }}>
      <Box sx={{
        width: 160, aspectRatio: '745 / 1040',
        borderRadius: '5px', flexShrink: 0, overflow: 'hidden',
        border: `0.5px solid ${SR.border}`, backgroundColor: SR.surfaceCard,
      }}>
        {imgUrl && (
          <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cardDisplayName(card)}
        </Box>
        {card.typeLine && (
          <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, color: SR.textFaint, mt: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.typeLine}
          </Box>
        )}
        {card.oracleText && (
          <Box sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textMuted, mt: '6px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {card.oracleText}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        {effectiveCount > 0 && (
          <>
            <Box component="button" onClick={onRemove} sx={btnSx}>−</Box>
            <Box sx={{ fontFamily: SR.fontMono, fontSize: 12, color: SR.textMuted, minWidth: 18, textAlign: 'center' }}>
              {effectiveCount}
            </Box>
          </>
        )}
        <Box component="button" onClick={onAdd} sx={btnSx}>+</Box>
      </Box>
    </Box>
  );
};

export default SearchResult;
