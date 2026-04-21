import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import type { Card } from '../CardImage';
import { cardDisplayName } from '../CardImage';

const TYPE_ORDER = ['Planeswalker', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land'];

function getPrimaryType(typeLine: string | null | undefined): string {
  for (const t of TYPE_ORDER) {
    if (typeLine?.includes(t)) return t;
  }
  return 'Other';
}

interface CountedCard { card: Card; count: number; }

function dedupeWithCount(cards: Card[]): CountedCard[] {
  const map = new Map<string, CountedCard>();
  cards.forEach(c => {
    const e = map.get(c.id);
    if (e) e.count++;
    else map.set(c.id, { card: c, count: 1 });
  });
  return [...map.values()];
}

// ── Card row ──────────────────────────────────────────────────────────────────

interface RowProps {
  card: Card;
  count: number;
  italic?: boolean;
  removing?: boolean;
  added?: boolean;
  onRemove?: () => void;
  onUndo?: () => void;
  onSetPortrait?: () => void;
}

const PortraitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="10" height="10" rx="1.5" />
    <circle cx="4.5" cy="4.5" r="1.5" />
    <path d="M1 8.5 L3.5 6.5 L5.5 8 L8 5.5 L11 8.5" />
  </svg>
);

const CardRow = ({ card, count, italic, removing, added, onRemove, onUndo, onSetPortrait }: RowProps) => {
  const [hov, setHov] = useState(false);
  const isPending = removing || added;
  return (
    <Box
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      sx={{
        display: 'flex', alignItems: 'center', padding: '6px 14px',
        borderBottom: `0.5px solid ${SR.border}`, gap: '10px',
        backgroundColor: removing ? SR.accentRedBg : added ? SR.surfacePanel : hov ? SR.surfaceCard : SR.surfaceApp,
        transition: 'background 80ms',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ fontFamily: SR.fontMono, fontSize: 11, color: removing ? SR.accentRed : SR.textMuted, width: 22, flexShrink: 0 }}>
        {count}x
      </Box>
      <Box sx={{
        flex: 1, fontFamily: SR.fontUi, fontSize: 13,
        color: removing ? SR.accentRed : added ? SR.textFaint : SR.textPrimary,
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: removing ? 'line-through' : 'none',
      }}>
        {cardDisplayName(card)}
      </Box>
      {(isPending || hov) && (onRemove || onUndo) ? (
        <>
          {hov && !isPending && onSetPortrait && card.artCropUrl && (
            <Box
              component="button"
              onClick={onSetPortrait}
              title="Set as deck portrait"
              sx={{
                background: 'none', border: `0.5px solid ${SR.border}`, borderRadius: '4px',
                padding: '4px 6px', cursor: 'pointer', color: SR.textFaint,
                display: 'flex', alignItems: 'center',
                '&:hover': { borderColor: SR.textMuted, color: SR.textMuted },
              }}
            >
              <PortraitIcon />
            </Box>
          )}
          <Box
            component="button"
            onClick={isPending ? onUndo : onRemove}
            sx={{
              background: 'none', border: `0.5px solid ${SR.border}`, borderRadius: '4px',
              padding: '2px 8px', cursor: 'pointer', fontFamily: SR.fontUi, fontSize: 10,
              color: isPending ? SR.textMuted : SR.accentRed,
              '&:hover': { borderColor: isPending ? SR.textMuted : SR.accentRed },
            }}
          >
            {isPending ? 'undo' : 'remove'}
          </Box>
        </>
      ) : (
        !hov && !isPending && card.typeLine && (
          <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
            {card.typeLine.split('—')[0].trim()}
          </Box>
        )
      )}
    </Box>
  );
};

// ── Card group ────────────────────────────────────────────────────────────────

interface GroupProps {
  label: string;
  counted: CountedCard[];
  isCommander?: boolean;
  pendingRemoves: Set<string>;
  pendingAdds: Set<string>;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
  onSetPortrait: (url: string) => void;
}

const CardGroup = ({ label, counted, isCommander, pendingRemoves, pendingAdds, onRemove, onUndo, onSetPortrait }: GroupProps) => {
  const total = counted.reduce((s, { count }) => s + count, 0);
  return (
    <Box sx={{ border: `0.5px solid ${SR.border}`, borderRadius: '7px', overflow: 'hidden' }}>
      <Box sx={{
        padding: '7px 14px 5px',
        fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.1em', color: SR.textFaint,
        backgroundColor: SR.surfacePanel, borderBottom: `0.5px solid ${SR.border}`,
      }}>
        {label} — {total}
      </Box>
      {counted.map(({ card, count }) => (
        <CardRow
          key={card.id}
          card={card}
          count={count}
          italic={isCommander}
          removing={pendingRemoves.has(card.id)}
          added={pendingAdds.has(card.id)}
          onRemove={() => onRemove(card.id)}
          onUndo={() => onUndo(card.id)}
          onSetPortrait={card.artCropUrl ? () => onSetPortrait(card.artCropUrl!) : undefined}
        />
      ))}
    </Box>
  );
};

// ── Card list view ─────────────────────────────────────────────────────────────

interface Props {
  commanderCards: Card[];
  mainCards: Card[];
  addedCards: Card[];
  pendingAdds: Set<string>;
  pendingRemoves: Set<string>;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
  onSetPortrait: (url: string) => void;
}

const CardListView = ({ commanderCards, mainCards, addedCards, pendingAdds, pendingRemoves, onRemove, onUndo, onSetPortrait }: Props) => {
  // Merge current + staged adds (deduplicated)
  const allCards = [...mainCards, ...addedCards.filter(ac => !mainCards.some(c => c.id === ac.id))];
  const deduped = dedupeWithCount(allCards);
  const commanders = dedupeWithCount(commanderCards);

  const visibleMain = deduped;

  // Group by type
  const grouped: Record<string, CountedCard[]> = {};
  visibleMain.forEach(cc => {
    const t = getPrimaryType(cc.card.typeLine);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(cc);
  });

  // Build ordered group list
  const allGroups: { key: string; label: string; counted: CountedCard[]; isCommander?: boolean }[] = [];
  if (commanders.length) {
    allGroups.push({ key: 'commanders', label: 'Commanders', counted: commanders, isCommander: true });
  }
  TYPE_ORDER.filter(t => t !== 'Land').forEach(t => {
    if (grouped[t]?.length) allGroups.push({ key: t, label: `${t}s`, counted: grouped[t] });
  });
  if (grouped['Other']?.length) allGroups.push({ key: 'other', label: 'Other', counted: grouped['Other'] });
  if (grouped['Land']?.length) allGroups.push({ key: 'lands', label: 'Lands', counted: grouped['Land'] });

  // Bin-pack into 2 columns
  const cols: (typeof allGroups)[] = [[], []];
  const heights = [0, 0];
  allGroups.forEach(g => {
    const pick = heights[0] <= heights[1] ? 0 : 1;
    cols[pick].push(g);
    heights[pick] += g.counted.length + 1.5;
  });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '20px 26px', columnGap: '24px', rowGap: '14px', alignItems: 'start' }}>
      {cols.map((col, ci) => (
        <Box key={ci} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {col.map(g => (
            <CardGroup
              key={g.key}
              label={g.label}
              counted={g.counted}
              isCommander={g.isCommander}
              pendingRemoves={pendingRemoves}
              pendingAdds={pendingAdds}
              onRemove={onRemove}
              onUndo={onUndo}
              onSetPortrait={onSetPortrait}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default CardListView;
