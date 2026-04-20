import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import CardImage, { Card, cardDisplayName } from './CardImage';
import { SR } from '../theme';

interface Props {
  currentCards: Card[];
  addedCards: Card[];
  pendingRemoves: Set<string>;
  viewMode: 'list' | 'images';
  onRemove: (cardId: string) => void;
  onUndo: (cardId: string) => void;
}

const circularSx = {
  width: 'clamp(24px, 2.3vw, 36px)',
  height: 'clamp(24px, 2.3vw, 36px)',
  padding: 0,
};

const DecklistCards = ({ currentCards, addedCards, pendingRemoves, viewMode, onRemove, onUndo }: Props) => {
  const containerSx = {
    overflow: 'auto', flex: 1,
    border: `0.5px solid ${SR.border}`,
    borderRadius: '6px',
    backgroundColor: SR.surfaceApp,
  };

  if (viewMode === 'list') {
    return (
      <Box component="ul" sx={{ ...containerSx, listStyle: 'none', m: 0, p: 0 }}>
        {currentCards.map((card) => {
          const removing = pendingRemoves.has(card.id);
          return (
            <Box
              component="li"
              key={card.id}
              sx={{
                display: 'flex', alignItems: 'center',
                padding: '7px 14px',
                borderBottom: `0.5px solid ${SR.border}`,
                gap: '10px',
                textDecoration: removing ? 'line-through' : 'none',
                opacity: removing ? 0.45 : 1,
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box sx={{ fontFamily: SR.fontMono, fontSize: 11, color: SR.textMuted, width: 28, flexShrink: 0 }}>
                1x
              </Box>
              <Box sx={{ flex: 1, fontFamily: SR.fontUi, fontSize: 13, color: SR.textPrimary }}>
                {cardDisplayName(card)}
              </Box>
              {removing ? (
                <Button size="small" onClick={() => onUndo(card.id)} sx={{ fontSize: 11, color: SR.accentTeal, minWidth: 0, px: 1 }}>
                  Undo
                </Button>
              ) : (
                <IconButton size="small" onClick={() => onRemove(card.id)} aria-label="remove" sx={{ color: SR.textFaint, '&:hover': { color: SR.accentRed } }}>
                  <Box component="span" sx={{ fontSize: 12, lineHeight: 1 }}>✕</Box>
                </IconButton>
              )}
            </Box>
          );
        })}
        {addedCards.map((card) => (
          <Box
            component="li"
            key={card.id}
            sx={{
              display: 'flex', alignItems: 'center',
              padding: '7px 14px',
              borderBottom: `0.5px solid ${SR.border}`,
              gap: '10px',
              backgroundColor: SR.accentTealBg,
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Box sx={{ flex: 1, fontFamily: SR.fontUi, fontSize: 13, color: SR.accentTeal }}>
              + {cardDisplayName(card)}
            </Box>
            <Button size="small" onClick={() => onUndo(card.id)} sx={{ fontSize: 11, color: SR.accentTeal, minWidth: 0, px: 1 }}>
              Undo
            </Button>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={containerSx}>
      <Grid container spacing={2} sx={{ p: 1 }}>
        {currentCards.map((card) => {
          const removing = pendingRemoves.has(card.id);
          return (
            <Grid size={{ xs: 6, md: 3 }} key={card.id}>
              <CardImage
                card={card}
                dimmed={removing}
                action={
                  removing ? (
                    <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
                      Undo
                    </Button>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={() => onRemove(card.id)}
                      aria-label="remove"
                      sx={{ ...circularSx, bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
                    >
                      ✕
                    </IconButton>
                  )
                }
              />
            </Grid>
          );
        })}
        {addedCards.map((card) => (
          <Grid size={{ xs: 6, md: 3 }} key={card.id}>
            <CardImage
              card={card}
              addedHighlight
              action={
                <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
                  Undo
                </Button>
              }
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DecklistCards;
