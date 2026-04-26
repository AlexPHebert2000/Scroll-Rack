import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import type { Card, CardArt } from '../CardImage';
import { cardDisplayName } from '../CardImage';
import CardMenu from './CardMenu';

export type BoardKey = 'MAIN' | 'SIDE' | 'COMMANDER' | 'CONSIDERING';

export const BOARD_LABELS: Record<BoardKey, string> = {
  MAIN: 'Main deck',
  SIDE: 'Sideboard',
  COMMANDER: 'Commander',
  CONSIDERING: 'Considering',
};


export const TYPE_ORDER = ['Planeswalker', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land'];

export function getPrimaryType(typeLine: string | null | undefined): string {
  for (const t of TYPE_ORDER) {
    if (typeLine?.includes(t)) return t;
  }
  return 'Other';
}

export interface CountedCard { card: Card; count: number; }

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

const ArtIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="3" width="7" height="7" rx="1" />
    <rect x="3.5" y="1" width="7" height="7" rx="1" />
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
  artCropUrl?: string | null;
  hasArtOverride?: boolean;
  onAddOne: () => void;
  onRemoveOne: () => void;
  onRemoveAll: () => void;
  onOpenSetCount: () => void;
  onSetPortrait?: () => void;
  onSelectArt?: () => void;
  onMove: (toBoard: BoardKey) => void;
}

const CardRow = ({ card, effectiveCount, committed, italic, board, isMoveHere, isMoveAway, artCropUrl, hasArtOverride, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onSelectArt, onMove }: RowProps) => {
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
          {onSetPortrait && artCropUrl && (
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

      <CardMenu
        anchorEl={menuAnchor}
        board={board}
        effectiveCount={effectiveCount}
        hasArtOverride={hasArtOverride}
        onClose={closeMenu}
        onAddOne={onAddOne}
        onRemoveOne={onRemoveOne}
        onRemoveAll={onRemoveAll}
        onOpenSetCount={onOpenSetCount}
        onSelectArt={onSelectArt}
        onMove={onMove}
      />
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
  resolveArt?: (card: Card) => CardArt | null;
  onAddOne: (card: Card) => void;
  onRemoveOne: (id: string) => void;
  onRemoveAll: (id: string) => void;
  onOpenSetCount: (id: string) => void;
  onSetPortrait: (url: string) => void;
  onSelectArt?: (card: Card) => void;
  onMove: (card: Card, toBoard: BoardKey) => void;
}

const CardGroup = ({ label, counted, board, isCommander, pendingChanges, resolveArt, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onSelectArt, onMove }: GroupProps) => {
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

        const resolvedArt = resolveArt ? resolveArt(card) : (card.defaultArt ?? null);
        const artCropUrl = resolvedArt?.artCropUrl ?? null;
        const hasArtOverride = Boolean(resolvedArt && resolvedArt.id !== (card.defaultArt?.id ?? ''));
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
            artCropUrl={artCropUrl}
            hasArtOverride={hasArtOverride}
            onAddOne={() => onAddOne(card)}
            onRemoveOne={() => onRemoveOne(card.id)}
            onRemoveAll={() => onRemoveAll(card.id)}
            onOpenSetCount={() => onOpenSetCount(card.id)}
            onSetPortrait={artCropUrl ? () => onSetPortrait(artCropUrl) : undefined}
            onSelectArt={onSelectArt ? () => onSelectArt(card) : undefined}
            onMove={toBoard => onMove(card, toBoard)}
          />
        );
      })}
    </Box>
  );
};

// ── Layout helpers ─────────────────────────────────────────────────────────────

export interface BoardPack { committed: Card[]; added: Card[]; }

export type GroupDef = { key: string; label: string; counted: CountedCard[]; board: BoardKey; isCommander?: boolean };

const TYPE_LABELS: Record<string, string> = {
  Sorcery: 'Sorceries', Land: 'Lands',
};
const byCmc = (arr: CountedCard[]) =>
  [...arr].sort((a, b) => (a.card.cmc ?? 0) - (b.card.cmc ?? 0) || a.card.name.localeCompare(b.card.name));

export function buildTypeGroups(committed: Card[], added: Card[], board: BoardKey, excludeAddedIds: Set<string>): GroupDef[] {
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

  const label = (t: string) => TYPE_LABELS[t] ?? `${t}s`;
  const result: GroupDef[] = [];
  TYPE_ORDER.filter(t => t !== 'Land').forEach(t => {
    if (grouped[t]?.length) result.push({ key: t, label: label(t), counted: byCmc(grouped[t]), board });
  });
  if (grouped['Other']?.length) result.push({ key: 'other', label: 'Other', counted: byCmc(grouped['Other']), board });
  if (grouped['Land']?.length) result.push({ key: 'lands', label: 'Lands', counted: byCmc(grouped['Land']), board });
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
  resolveArt?: (card: Card) => CardArt | null;
  onAddOne: (card: Card, board: BoardKey) => void;
  onRemoveOne: (id: string, board: BoardKey) => void;
  onRemoveAll: (id: string, board: BoardKey) => void;
  onOpenSetCount: (id: string, board: BoardKey) => void;
  onSetPortrait: (url: string) => void;
  onSelectArt?: (card: Card) => void;
  onMove: (card: Card, fromBoard: BoardKey, toBoard: BoardKey) => void;
}

const CardListView = ({
  activeBoard, main, commander, side, considering,
  pendingChanges, resolveArt, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onSelectArt, onMove,
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
                resolveArt={resolveArt}
                onAddOne={card => onAddOne(card, g.board)}
                onRemoveOne={id => onRemoveOne(id, g.board)}
                onRemoveAll={id => onRemoveAll(id, g.board)}
                onOpenSetCount={id => onOpenSetCount(id, g.board)}
                onSetPortrait={onSetPortrait}
                onSelectArt={onSelectArt}
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
