import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { SR } from '../../theme';
import type { Card } from '../CardImage';
import { cardDisplayName } from '../CardImage';

export type BoardKey = 'MAIN' | 'SIDE' | 'COMMANDER' | 'CONSIDERING';

export const BOARD_LABELS: Record<BoardKey, string> = {
  MAIN: 'Main deck',
  SIDE: 'Sideboard',
  COMMANDER: 'Commander',
  CONSIDERING: 'Considering',
};

const ALL_BOARDS: BoardKey[] = ['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING'];

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

// ── Portrait icon ─────────────────────────────────────────────────────────────

const PortraitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="10" height="10" rx="1.5" />
    <circle cx="4.5" cy="4.5" r="1.5" />
    <path d="M1 8.5 L3.5 6.5 L5.5 8 L8 5.5 L11 8.5" />
  </svg>
);

// ── Card row ──────────────────────────────────────────────────────────────────

interface RowProps {
  card: Card;
  effectiveCount: number;
  committed: number;
  italic?: boolean;
  board: BoardKey;
  isMoveHere?: boolean;
  isMoveAway?: boolean;
  onAddOne: () => void;
  onRemoveOne: () => void;
  onRemoveAll: () => void;
  onOpenSetCount: () => void;
  onSetPortrait?: () => void;
  onMove: (toBoard: BoardKey) => void;
}

const CardRow = ({ card, effectiveCount, committed, italic, board, isMoveHere, isMoveAway, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove }: RowProps) => {
  const [hov, setHov] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const isMove = isMoveHere || isMoveAway;
  const pendingAdded = !isMove && effectiveCount > committed;
  const pendingRemoved = !isMove && effectiveCount < committed;
  const countColor = isMoveHere ? SR.accentGold : pendingAdded ? SR.accentTealLight : pendingRemoved ? SR.accentRed : SR.textMuted;
  const closeMenu = () => { setMenuAnchor(null); setHov(false); };

  return (
    <Box
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { if (!menuAnchor) setHov(false); }}
      sx={{
        display: 'flex', alignItems: 'center', padding: '6px 14px',
        borderBottom: `0.5px solid ${SR.border}`, gap: '10px',
        backgroundColor: isMoveHere ? SR.accentGoldLight : pendingAdded ? SR.surfacePanel : pendingRemoved ? SR.accentRedBg : hov ? SR.surfaceCard : SR.surfaceApp,
        transition: 'background 80ms',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{
        fontFamily: SR.fontMono, fontSize: 11, color: countColor,
        width: 22, flexShrink: 0,
      }}>
        {effectiveCount}x
      </Box>

      <Box sx={{
        flex: 1, fontFamily: SR.fontUi, fontSize: 13,
        color: isMoveHere ? SR.accentGold : pendingRemoved ? SR.accentRed : pendingAdded ? SR.textFaint : SR.textPrimary,
        fontStyle: italic ? 'italic' : 'normal',
      }}>
        {cardDisplayName(card)}
      </Box>

      {hov || Boolean(menuAnchor) ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {onSetPortrait && card.artCropUrl && (
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
            onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
            sx={{
              background: 'none', border: `0.5px solid ${SR.border}`, borderRadius: '4px',
              padding: '1px 10px 3px', cursor: 'pointer',
              fontFamily: SR.fontMono, fontSize: 16, lineHeight: 1,
              color: SR.textMuted,
              '&:hover': { borderColor: SR.textMuted, color: SR.textPrimary },
            }}
          >
            ···
          </Box>
        </Box>
      ) : (
        !pendingAdded && !pendingRemoved && card.typeLine && (
          <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint, flexShrink: 0 }}>
            {card.typeLine.split('—')[0].trim()}
          </Box>
        )
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        PaperProps={{ sx: { backgroundColor: SR.surfacePanel, border: `0.5px solid ${SR.border}`, borderRadius: 1, minWidth: 160 } }}
      >
        <MenuItem onClick={() => { onAddOne(); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Add 1</MenuItem>
        <MenuItem onClick={() => { onOpenSetCount(); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Set count</MenuItem>
        <MenuItem onClick={() => { onRemoveOne(); closeMenu(); }} disabled={effectiveCount <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Remove 1</MenuItem>
        <MenuItem onClick={() => { onRemoveAll(); closeMenu(); }} disabled={effectiveCount <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.accentRed }}>Remove all</MenuItem>
        <Divider sx={{ borderColor: SR.border, my: '4px' }} />
        {ALL_BOARDS.filter(b => b !== board).map(target => (
          <MenuItem key={target} onClick={() => { onMove(target); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>
            Move to {BOARD_LABELS[target]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

// ── Card group ────────────────────────────────────────────────────────────────

interface GroupProps {
  label: string;
  counted: CountedCard[];
  board: BoardKey;
  isCommander?: boolean;
  pendingChanges: Map<string, Partial<Record<BoardKey, number>>>;
  onAddOne: (card: Card) => void;
  onRemoveOne: (id: string) => void;
  onRemoveAll: (id: string) => void;
  onOpenSetCount: (id: string) => void;
  onSetPortrait: (url: string) => void;
  onMove: (card: Card, toBoard: BoardKey) => void;
}

const CardGroup = ({ label, counted, board, isCommander, pendingChanges, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove }: GroupProps) => {
  const total = counted.reduce((s, { card, count }) => {
    const eff = count + (pendingChanges.get(card.id)?.[board] ?? 0);
    return s + Math.max(0, eff);
  }, 0);

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
      {counted.map(({ card, count: committed }) => {
        const deltas = pendingChanges.get(card.id) ?? {};
        const deltaHere = deltas[board] ?? 0;
        const hasPositiveElsewhere = Object.entries(deltas).some(([b, d]) => b !== board && (d as number) > 0);
        const hasNegativeElsewhere = Object.entries(deltas).some(([b, d]) => b !== board && (d as number) < 0);
        const isMoveHere = deltaHere > 0 && hasNegativeElsewhere;
        const isMoveAway = deltaHere < 0 && hasPositiveElsewhere;
        const effectiveCount = committed + deltaHere;

        // Hide rows that have been fully moved to another board
        if (isMoveAway && effectiveCount <= 0) return null;

        return (
          <CardRow
            key={card.id}
            card={card}
            effectiveCount={effectiveCount}
            committed={committed}
            italic={isCommander}
            board={board}
            isMoveHere={isMoveHere}
            isMoveAway={isMoveAway}
            onAddOne={() => onAddOne(card)}
            onRemoveOne={() => onRemoveOne(card.id)}
            onRemoveAll={() => onRemoveAll(card.id)}
            onOpenSetCount={() => onOpenSetCount(card.id)}
            onSetPortrait={card.artCropUrl ? () => onSetPortrait(card.artCropUrl!) : undefined}
            onMove={toBoard => onMove(card, toBoard)}
          />
        );
      })}
    </Box>
  );
};

// ── Layout helpers ─────────────────────────────────────────────────────────────

export interface BoardPack { committed: Card[]; added: Card[]; }

type GroupDef = { key: string; label: string; counted: CountedCard[]; board: BoardKey; isCommander?: boolean };

function buildTypeGroups(committed: Card[], added: Card[], board: BoardKey, excludeAddedIds: Set<string>): GroupDef[] {
  const deduped = dedupeWithCount(committed);
  const seen = new Set(committed.map(c => c.id));
  for (const c of added) {
    if (!excludeAddedIds.has(c.id) && !seen.has(c.id)) {
      deduped.push({ card: c, count: 0 });
      seen.add(c.id);
    }
  }

  const grouped: Record<string, CountedCard[]> = {};
  deduped.forEach(cc => {
    const t = getPrimaryType(cc.card.typeLine);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(cc);
  });

  const result: GroupDef[] = [];
  TYPE_ORDER.filter(t => t !== 'Land').forEach(t => {
    if (grouped[t]?.length) result.push({ key: t, label: `${t}s`, counted: grouped[t], board });
  });
  if (grouped['Other']?.length) result.push({ key: 'other', label: 'Other', counted: grouped['Other'], board });
  if (grouped['Land']?.length) result.push({ key: 'lands', label: 'Lands', counted: grouped['Land'], board });
  return result;
}

function twoCols(groups: GroupDef[]): [GroupDef[], GroupDef[]] {
  const cols: [GroupDef[], GroupDef[]] = [[], []];
  const h = [0, 0];
  groups.forEach(g => {
    const p = h[0] <= h[1] ? 0 : 1;
    cols[p].push(g);
    h[p] += g.counted.length + 1.5;
  });
  return cols;
}

// ── Card list view ─────────────────────────────────────────────────────────────

interface Props {
  activeBoard: 'main' | 'side' | 'considering';
  main: BoardPack;
  commander: BoardPack;
  side: BoardPack;
  considering: BoardPack;
  pendingChanges: Map<string, Partial<Record<BoardKey, number>>>;
  onAddOne: (card: Card, board: BoardKey) => void;
  onRemoveOne: (id: string, board: BoardKey) => void;
  onRemoveAll: (id: string, board: BoardKey) => void;
  onOpenSetCount: (id: string, board: BoardKey) => void;
  onSetPortrait: (url: string) => void;
  onMove: (card: Card, fromBoard: BoardKey, toBoard: BoardKey) => void;
}

const CardListView = ({
  activeBoard, main, commander, side, considering,
  pendingChanges, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove,
}: Props) => {

  const renderGrid = (groups: GroupDef[]) => {
    const [left, right] = twoCols(groups);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '20px 26px', columnGap: '24px', rowGap: '14px', alignItems: 'start' }}>
        {[left, right].map((col, ci) => (
          <Box key={ci} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {col.map(g => (
              <CardGroup
                key={g.key}
                label={g.label}
                counted={g.counted}
                board={g.board}
                isCommander={g.isCommander}
                pendingChanges={pendingChanges}
                onAddOne={card => onAddOne(card, g.board)}
                onRemoveOne={id => onRemoveOne(id, g.board)}
                onRemoveAll={id => onRemoveAll(id, g.board)}
                onOpenSetCount={id => onOpenSetCount(id, g.board)}
                onSetPortrait={onSetPortrait}
                onMove={(card, toBoard) => onMove(card, g.board, toBoard)}
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  };

  if (activeBoard === 'main') {
    const committedCmdIds = new Set(commander.committed.map(c => c.id));
    const cmdDeduped = dedupeWithCount(commander.committed);
    const seenCmd = new Set(commander.committed.map(c => c.id));
    for (const c of commander.added) {
      if (!seenCmd.has(c.id)) { cmdDeduped.push({ card: c, count: 0 }); seenCmd.add(c.id); }
    }
    const cmdGroups: GroupDef[] = cmdDeduped.length
      ? [{ key: 'commanders', label: 'Commanders', counted: cmdDeduped, board: 'COMMANDER', isCommander: true }]
      : [];
    const mainGroups = buildTypeGroups(main.committed, main.added, 'MAIN', committedCmdIds);
    return renderGrid([...cmdGroups, ...mainGroups]);
  }

  if (activeBoard === 'side') {
    const groups = buildTypeGroups(side.committed, side.added, 'SIDE', new Set());
    if (!groups.length) return (
      <Box sx={{ padding: '40px 26px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>
        No cards in sideboard. Use the ··· menu on any card to move it here.
      </Box>
    );
    return renderGrid(groups);
  }

  const groups = buildTypeGroups(considering.committed, considering.added, 'CONSIDERING', new Set());
  if (!groups.length) return (
    <Box sx={{ padding: '40px 26px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>
      No cards in considering. Use the ··· menu on any card to move it here.
    </Box>
  );
  return renderGrid(groups);
};

export default CardListView;
