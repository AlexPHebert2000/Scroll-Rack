import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CardImage, { Card, cardDisplayName } from './CardImage';
import CommitGraph from './decklist/CommitGraph';
import type { Commit } from './decklist/CommitGraph';
import ArtBanner from './decklist/ArtBanner';
import CardListView from './decklist/CardListView';
import type { BoardKey, BoardPack } from './decklist/CardListView';
import { BOARD_LABELS } from './decklist/CardListView';
import SearchDrawer from './decklist/SearchDrawer';
import { buildGraph, buildBranchColors } from './decklist/graphUtils';
import type { GraphBranch } from './decklist/graphUtils';
import { SR } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type BoardDeltas = Partial<Record<BoardKey, number>>;

interface DecklistState { mainDeck: Card[]; sideBoard: Card[]; commander: Card[]; considering: Card[]; }
interface Branch { id: string; name: string; headCommitId: string | null; decklist: DecklistState; commits: Commit[]; }
interface Deck {
  id: string; name: string;
  portraitUrl: string | null;
  branches: Branch[];
  allBranches: { id: string; name: string }[];
  graphBranches: GraphBranch[];
}

const ALL_BOARDS: BoardKey[] = ['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING'];

// ── Small UI primitives ────────────────────────────────────────────────────────

const Tag = ({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'neutral' | 'gold' | 'teal' }) => {
  const styles = {
    neutral: { backgroundColor: SR.surfaceCard, color: SR.textMuted, borderColor: SR.border },
    gold: { backgroundColor: SR.accentGoldLight, color: SR.accentGold, borderColor: SR.accentGoldBorder },
    teal: { backgroundColor: SR.accentTealBg, color: SR.accentTealLight, borderColor: SR.accentTealLight },
  };
  const s = styles[variant];
  return (
    <Box component="span" sx={{
      ...s, border: '0.5px solid', borderRadius: '3px',
      fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500,
      padding: '2px 8px', display: 'inline-flex', alignItems: 'center', letterSpacing: '0.02em',
    }}>
      {children}
    </Box>
  );
};

// ── Image card item ────────────────────────────────────────────────────────────

const ImageCardItem = ({
  card, effective, committed, board,
  onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove,
}: {
  card: Card;
  effective: number;
  committed: number;
  board: BoardKey;
  onAddOne: () => void;
  onRemoveOne: () => void;
  onRemoveAll: () => void;
  onOpenSetCount: () => void;
  onSetPortrait?: () => void;
  onMove: (toBoard: BoardKey) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const pendingAdded = effective > committed;
  const pendingRemoved = effective < committed && committed > 0;
  const countColor = pendingAdded ? SR.accentTealLight : pendingRemoved ? SR.accentRed : 'rgba(255,255,255,0.88)';
  const showCount = effective !== 1 || hovered || Boolean(menuAnchor);
  const closeMenu = () => { setMenuAnchor(null); setHovered(false); };

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!menuAnchor) setHovered(false); }}
      sx={{ position: 'relative', borderRadius: '8px' }}
    >
      <CardImage card={card} dimmed={pendingAdded && committed === 0} />

      {pendingRemoved && (
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '8px',
          backgroundColor: 'rgba(122,48,40,0.22)', pointerEvents: 'none',
        }} />
      )}

      <Box sx={{
        position: 'absolute', top: 8, right: 8, zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px',
      }}>
        {showCount && (
          <Box sx={{
            background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(4px)',
            borderRadius: '999px', padding: '2px 9px',
            fontFamily: SR.fontMono, fontSize: 12, fontWeight: 600,
            color: countColor, border: '0.5px solid rgba(255,255,255,0.13)',
          }}>
            {effective}x
          </Box>
        )}
        {(hovered || Boolean(menuAnchor)) && (
          <Box
            component="button"
            onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
            sx={{
              background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(4px)',
              border: '0.5px solid rgba(255,255,255,0.13)', borderRadius: '4px',
              padding: '2px 10px 4px', cursor: 'pointer',
              fontFamily: SR.fontMono, fontSize: 16, lineHeight: 1,
              color: 'rgba(255,255,255,0.7)',
              '&:hover': { background: 'rgba(0,0,0,0.75)' },
            }}
          >
            ···
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        PaperProps={{ sx: { backgroundColor: SR.surfacePanel, border: `0.5px solid ${SR.border}`, borderRadius: 1, minWidth: 160 } }}
      >
        <MenuItem onClick={() => { onAddOne(); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Add 1</MenuItem>
        <MenuItem onClick={() => { onOpenSetCount(); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Set count</MenuItem>
        <MenuItem onClick={() => { onRemoveOne(); closeMenu(); }} disabled={effective <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Remove 1</MenuItem>
        <MenuItem onClick={() => { onRemoveAll(); closeMenu(); }} disabled={effective <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.accentRed }}>Remove all</MenuItem>
        {onSetPortrait && card.artCropUrl && [
          <Divider key="d" />,
          <MenuItem key="p" onClick={() => { onSetPortrait!(); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Set as portrait</MenuItem>,
        ]}
        <Divider sx={{ borderColor: SR.border }} />
        {ALL_BOARDS.filter(b => b !== board).map(target => (
          <MenuItem key={target} onClick={() => { onMove(target); closeMenu(); }} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>
            Move to {BOARD_LABELS[target]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

// ── Images view ───────────────────────────────────────────────────────────────

function dedupeBoard(pack: BoardPack, board: BoardKey, pendingChanges: Map<string, BoardDeltas>) {
  const map = new Map<string, { card: Card; committed: number }>();
  pack.committed.forEach(c => {
    const e = map.get(c.id);
    if (e) e.committed++;
    else map.set(c.id, { card: c, committed: 1 });
  });
  pack.added.forEach(c => {
    if (!map.has(c.id)) map.set(c.id, { card: c, committed: 0 });
  });
  return [...map.values()].map(({ card, committed }) => ({
    card, committed, board,
    effective: committed + (pendingChanges.get(card.id)?.[board] ?? 0),
  }));
}

const ImagesView = ({
  activeBoard, main, commander, side, considering,
  pendingChanges, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove,
}: {
  activeBoard: 'main' | 'side' | 'considering';
  main: BoardPack;
  commander: BoardPack;
  side: BoardPack;
  considering: BoardPack;
  pendingChanges: Map<string, BoardDeltas>;
  onAddOne: (card: Card, board: BoardKey) => void;
  onRemoveOne: (id: string, board: BoardKey) => void;
  onRemoveAll: (id: string, board: BoardKey) => void;
  onOpenSetCount: (id: string, board: BoardKey) => void;
  onSetPortrait: (url: string) => void;
  onMove: (card: Card, fromBoard: BoardKey, toBoard: BoardKey) => void;
}) => {
  const dedupedCmd = useMemo(() => dedupeBoard(commander, 'COMMANDER', pendingChanges), [commander, pendingChanges]);
  const allMain = useMemo(() => dedupeBoard(main, 'MAIN', pendingChanges), [main, pendingChanges]);
  const allSide = useMemo(() => dedupeBoard(side, 'SIDE', pendingChanges), [side, pendingChanges]);
  const allConsidering = useMemo(() => dedupeBoard(considering, 'CONSIDERING', pendingChanges), [considering, pendingChanges]);

  type DedupedItem = ReturnType<typeof dedupeBoard>[number];

  const Section = ({ title, items, board }: { title: string; items: DedupedItem[]; board: BoardKey }) => (
    <Box sx={{ mb: '24px' }}>
      <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: SR.textFaint, mb: '10px' }}>
        {title}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))', gap: '12px' }}>
        {items.map(({ card, committed, effective }) => (
          <ImageCardItem
            key={card.id}
            card={card}
            effective={effective}
            committed={committed}
            board={board}
            onAddOne={() => onAddOne(card, board)}
            onRemoveOne={() => onRemoveOne(card.id, board)}
            onRemoveAll={() => onRemoveAll(card.id, board)}
            onOpenSetCount={() => onOpenSetCount(card.id, board)}
            onSetPortrait={card.artCropUrl ? () => onSetPortrait(card.artCropUrl!) : undefined}
            onMove={toBoard => onMove(card, board, toBoard)}
          />
        ))}
      </Box>
    </Box>
  );

  if (activeBoard === 'main') {
    const spells = allMain.filter(({ card }) => !card.typeLine?.includes('Land'));
    const lands = allMain.filter(({ card }) => card.typeLine?.includes('Land'));
    return (
      <Box sx={{ padding: '20px 28px' }}>
        {dedupedCmd.length > 0 && <Section title="Commanders" items={dedupedCmd} board="COMMANDER" />}
        {spells.length > 0 && <Section title="Spells" items={spells} board="MAIN" />}
        {lands.length > 0 && <Section title="Lands" items={lands} board="MAIN" />}
      </Box>
    );
  }
  if (activeBoard === 'side') {
    if (!allSide.length) return <Box sx={{ padding: '40px 28px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>No cards in sideboard.</Box>;
    return <Box sx={{ padding: '20px 28px' }}><Section title="Sideboard" items={allSide} board="SIDE" /></Box>;
  }
  if (!allConsidering.length) return <Box sx={{ padding: '40px 28px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>No cards in considering.</Box>;
  return <Box sx={{ padding: '20px 28px' }}><Section title="Considering" items={allConsidering} board="CONSIDERING" /></Box>;
};

// ── Decklist page ─────────────────────────────────────────────────────────────

const Decklist = () => {
  const { id, branch } = useParams<{ id: string; branch?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deckQ = useQuery<{ data: Deck }>({
    queryKey: ['deckFetch', id, branch],
    queryFn: () => axios.get(`/api/deck/${id}${branch ? `/${branch}` : ''}`),
  });

  const deck: Deck | undefined = deckQ.data?.data;
  const currentBranch = deck?.branches?.[0];
  const mainCards = currentBranch?.decklist?.mainDeck ?? [];
  const commanderCards = currentBranch?.decklist?.commander ?? [];
  const sideCards = currentBranch?.decklist?.sideBoard ?? [];
  const consideringCards = currentBranch?.decklist?.considering ?? [];
  const commits = currentBranch?.commits ?? [];
  const branchId = currentBranch?.id;
  const headCommitId = currentBranch?.headCommitId ?? null;

  const graphNodes = useMemo(() => buildGraph(deck?.graphBranches ?? []), [deck?.graphBranches]);
  const branchColors = useMemo(() => buildBranchColors(deck?.graphBranches ?? []), [deck?.graphBranches]);

  // UI state
  const [viewMode, setViewMode] = useState<'text' | 'images'>('text');
  const [activeBoard, setActiveBoard] = useState<'main' | 'side' | 'considering'>('main');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDesc, setCommitDesc] = useState('');
  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);

  // Board-aware pending changes: cardId → per-board net deltas
  const [pendingChanges, setPendingChanges] = useState<Map<string, BoardDeltas>>(new Map());
  const hasPending = pendingChanges.size > 0;

  useEffect(() => {
    if (headCommitId) setSelectedCommit(headCommitId);
  }, [headCommitId]);

  // ── Board helpers ────────────────────────────────────────────────────────────

  const getBoardCards = (board: BoardKey): Card[] => ({
    MAIN: mainCards,
    SIDE: sideCards,
    COMMANDER: commanderCards,
    CONSIDERING: consideringCards,
  }[board]);

  const updateBoardDelta = (cardId: string, board: BoardKey, amount: number) => {
    setPendingChanges(s => {
      const n = new Map(s);
      const existing = n.get(cardId) ?? {};
      const next = (existing[board] ?? 0) + amount;
      const updated = { ...existing };
      if (next === 0) delete updated[board]; else updated[board] = next;
      if (Object.keys(updated).length === 0) n.delete(cardId);
      else n.set(cardId, updated);
      return n;
    });
  };

  // ── Staging ──────────────────────────────────────────────────────────────────

  const stageAdd = (card: Card, board: BoardKey = 'MAIN') => {
    queryClient.setQueryData(['card', card.id], card);
    updateBoardDelta(card.id, board, +1);
  };

  const stageRemove = (id: string, board: BoardKey) => {
    updateBoardDelta(id, board, -1);
  };

  const stageMove = (card: Card, fromBoard: BoardKey, toBoard: BoardKey) => {
    queryClient.setQueryData(['card', card.id], card);
    setPendingChanges(s => {
      const n = new Map(s);
      const existing = n.get(card.id) ?? {};
      const updated = { ...existing };
      const fromNext = (updated[fromBoard] ?? 0) - 1;
      if (fromNext === 0) delete updated[fromBoard]; else updated[fromBoard] = fromNext;
      const toNext = (updated[toBoard] ?? 0) + 1;
      if (toNext === 0) delete updated[toBoard]; else updated[toBoard] = toNext;
      if (Object.keys(updated).length === 0) n.delete(card.id);
      else n.set(card.id, updated);
      return n;
    });
  };

  const stageRemoveAll = (id: string, board: BoardKey) => {
    const committed = getBoardCards(board).filter(c => c.id === id).length;
    setPendingChanges(s => {
      const n = new Map(s);
      const existing = n.get(id) ?? {};
      const updated = { ...existing };
      if (committed === 0) delete updated[board]; else updated[board] = -committed;
      if (Object.keys(updated).length === 0) n.delete(id);
      else n.set(id, updated);
      return n;
    });
  };

  const undoChange = (id: string) => {
    setPendingChanges(s => { const n = new Map(s); n.delete(id); return n; });
  };

  // ── Set count dialog ─────────────────────────────────────────────────────────

  const [setCountTarget, setSetCountTarget] = useState<{ id: string; board: BoardKey; effective: number } | null>(null);
  const [setCountInput, setSetCountInput] = useState('');

  const openSetCount = (id: string, board: BoardKey) => {
    const committed = getBoardCards(board).filter(c => c.id === id).length;
    const effective = committed + (pendingChanges.get(id)?.[board] ?? 0);
    setSetCountTarget({ id, board, effective });
    setSetCountInput(String(effective));
  };

  const handleSetCount = () => {
    if (!setCountTarget) return;
    const target = parseInt(setCountInput, 10);
    if (isNaN(target) || target < 0) return;
    const { id, board } = setCountTarget;
    const committed = getBoardCards(board).filter(c => c.id === id).length;
    const delta = target - committed;
    setPendingChanges(s => {
      const n = new Map(s);
      const existing = n.get(id) ?? {};
      const updated = { ...existing };
      if (delta === 0) delete updated[board]; else updated[board] = delta;
      if (Object.keys(updated).length === 0) n.delete(id);
      else n.set(id, updated);
      return n;
    });
    setSetCountTarget(null);
  };

  // ── Added cards (per board — for new cards not yet committed) ─────────────────

  const getAddedForBoard = (board: BoardKey): Card[] =>
    [...pendingChanges.entries()]
      .filter(([cid, deltas]) => {
        const delta = deltas[board] ?? 0;
        return delta > 0 && !getBoardCards(board).some(c => c.id === cid);
      })
      .flatMap(([cid, deltas]) => {
        const card = queryClient.getQueryData<Card>(['card', cid]);
        return card ? Array(deltas[board]!).fill(card) : [];
      });

  const addedToMain = getAddedForBoard('MAIN');
  const addedToSide = getAddedForBoard('SIDE');
  const addedToConsidering = getAddedForBoard('CONSIDERING');
  const addedToCommander = getAddedForBoard('COMMANDER');

  // ── Pending changes list for commit graph ─────────────────────────────────────

  const getCardName = (id: string): string =>
    [...mainCards, ...commanderCards, ...sideCards, ...consideringCards].find(c => c.id === id)?.name
    ?? queryClient.getQueryData<Card>(['card', id])?.name
    ?? id;

  const pendingChangesList: { action: 'ADD' | 'REMOVE' | 'MOVE'; cardName: string }[] =
    [...pendingChanges.entries()].flatMap(([cid, boardDeltas]) => {
      const entries = Object.entries(boardDeltas) as [BoardKey, number][];
      const removes = entries.filter(([, d]) => d < 0);
      const adds = entries.filter(([, d]) => d > 0);
      const name = getCardName(cid);
      if (removes.length === 1 && adds.length === 1 && Math.abs(removes[0][1]) === adds[0][1]) {
        return [{ action: 'MOVE' as const, cardName: `${name}: ${BOARD_LABELS[removes[0][0]]} → ${BOARD_LABELS[adds[0][0]]}` }];
      }
      return [
        ...removes.map(([board, d]) => ({
          action: 'REMOVE' as const,
          cardName: `${Math.abs(d)}× ${name}${removes.length + adds.length > 1 ? ` (${BOARD_LABELS[board]})` : ''}`,
        })),
        ...adds.map(([board, d]) => ({
          action: 'ADD' as const,
          cardName: `${d}× ${name}${removes.length + adds.length > 1 ? ` (${BOARD_LABELS[board]})` : ''}`,
        })),
      ];
    });

  // ── Portrait mutation ────────────────────────────────────────────────────────

  const portraitMutation = useMutation({
    mutationFn: (portraitUrl: string) => axios.patch(`/api/deck/${id}/portrait`, { portraitUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deckFetch', id] }),
  });

  // ── Commit mutation ──────────────────────────────────────────────────────────

  const commitMutation = useMutation({
    mutationFn: (payload: {
      description: string;
      changes: { action: string; board: string; cardId: string; count: number }[];
      mainDeck: string[]; sideBoard: string[]; commander: string[]; considering: string[];
      portraitUrl?: string | null;
    }) => axios.post(`/api/deck/${id}/${branchId}`, payload),
    onSuccess: () => {
      setPendingChanges(new Map());
      setCommitOpen(false);
      setCommitDesc('');
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
    },
  });

  const handleCommit = () => {
    const changes: { action: string; board: string; cardId: string; count: number }[] = [];

    const toCounts = (cards: Card[]) => {
      const m = new Map<string, number>();
      cards.forEach(c => m.set(c.id, (m.get(c.id) ?? 0) + 1));
      return m;
    };
    const snapshots: Record<BoardKey, Map<string, number>> = {
      MAIN: toCounts(mainCards),
      SIDE: toCounts(sideCards),
      COMMANDER: toCounts(commanderCards),
      CONSIDERING: toCounts(consideringCards),
    };

    pendingChanges.forEach((boardDeltas, cardId) => {
      (Object.entries(boardDeltas) as [BoardKey, number][]).forEach(([board, delta]) => {
        if (delta === 0) return;
        changes.push({ action: delta > 0 ? 'ADD' : 'REMOVE', board, cardId, count: Math.abs(delta) });
        const snap = snapshots[board];
        const next = (snap.get(cardId) ?? 0) + delta;
        if (next <= 0) snap.delete(cardId); else snap.set(cardId, next);
      });
    });

    const toIds = (m: Map<string, number>) => [...m.entries()].flatMap(([cid, count]) => Array(count).fill(cid));

    let autoPortrait: string | null | undefined;
    if (!deck?.portraitUrl) {
      const portraitCard = commanderCards[0] ?? [...mainCards, ...addedToMain].find(c => (pendingChanges.get(c.id)?.MAIN ?? 0) >= 0);
      autoPortrait = portraitCard?.artCropUrl ?? null;
    }

    commitMutation.mutate({
      description: commitDesc,
      changes,
      mainDeck: toIds(snapshots.MAIN),
      sideBoard: toIds(snapshots.SIDE),
      commander: toIds(snapshots.COMMANDER),
      considering: toIds(snapshots.CONSIDERING),
      portraitUrl: autoPortrait,
    });
  };

  const handleSetPortrait = (portraitUrl: string) => portraitMutation.mutate(portraitUrl);

  // ── Derived stats (main + commander board) ───────────────────────────────────

  const mainDelta = [...pendingChanges.values()].reduce((s, b) => s + (b.MAIN ?? 0), 0);
  const cmdDelta = [...pendingChanges.values()].reduce((s, b) => s + (b.COMMANDER ?? 0), 0);
  const totalCards = mainCards.length + commanderCards.length + mainDelta + cmdDelta;
  const spellCount = [...mainCards, ...addedToMain].filter(c => !c.typeLine?.includes('Land')).length;
  const landCount = [...mainCards, ...addedToMain].filter(c => c.typeLine?.includes('Land')).length;

  const pendingCount = [...pendingChanges.values()].reduce((sum, boards) =>
    sum + Object.values(boards).reduce((a, b) => a + Math.abs(b), 0), 0
  );

  // ── Board packs ───────────────────────────────────────────────────────────────

  const boardPacks: Record<'main' | 'side' | 'commander' | 'considering', BoardPack> = {
    main: { committed: mainCards, added: addedToMain },
    commander: { committed: commanderCards, added: addedToCommander },
    side: { committed: sideCards, added: addedToSide },
    considering: { committed: consideringCards, added: addedToConsidering },
  };

  // ── Loading / error states ───────────────────────────────────────────────────

  if (deckQ.isLoading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 50px)' }}>
      <Typography sx={{ fontFamily: SR.fontMono, fontSize: 12, color: SR.textFaint }}>loading…</Typography>
    </Box>
  );
  if (deckQ.isError) return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.accentRed }}>Failed to load deck.</Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', overflow: 'hidden', backgroundColor: SR.surfaceApp }}>

      {/* ── Left: Commit graph ──────────────────────────────────────────────── */}
      <CommitGraph
        nodes={graphNodes}
        branchColors={branchColors}
        headCommitId={headCommitId}
        branchName={currentBranch?.name ?? 'main'}
        branchCommits={commits}
        pendingChanges={pendingChangesList}
        selectedHash={selectedCommit}
        onSelect={setSelectedCommit}
      />

      {/* ── Centre: Deck view ───────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <ArtBanner deckName={deck?.name ?? ''} portraitUrl={deck?.portraitUrl ?? null} onChangePortrait={() => setPortraitPickerOpen(true)} />

        {/* Deck header */}
        <Box sx={{ padding: '14px 20px 0', borderBottom: `0.5px solid ${SR.border}`, flexShrink: 0 }}>

          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: '12px' }}>
            <Box>
              <Box sx={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Box
                  component="select"
                  value={branch ?? currentBranch?.id ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => navigate(`/deck/${id}/${e.target.value}`)}
                  sx={{
                    fontFamily: SR.fontMono, fontSize: 10, fontWeight: 500,
                    backgroundColor: SR.surfaceCard, color: SR.textMuted,
                    border: `0.5px solid ${SR.border}`, borderRadius: '3px',
                    padding: '2px 6px', cursor: 'pointer', outline: 'none', appearance: 'none',
                  }}
                >
                  {(deck?.allBranches ?? []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Box>
                {headCommitId && <Tag variant="gold">{headCommitId.slice(0, 7)}</Tag>}
                {hasPending && (
                  <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                    {pendingCount} uncommitted change{pendingCount !== 1 ? 's' : ''}
                  </Box>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', backgroundColor: SR.surfaceCard, border: `0.5px solid ${SR.border}`, borderRadius: '6px', overflow: 'hidden' }}>
                {(['text', 'images'] as const).map(mode => (
                  <Box
                    key={mode}
                    component="button"
                    onClick={() => setViewMode(mode)}
                    sx={{
                      fontFamily: SR.fontUi, fontSize: 11, fontWeight: 500, padding: '5px 12px', cursor: 'pointer',
                      backgroundColor: viewMode === mode ? SR.surfaceInk : 'transparent',
                      color: viewMode === mode ? SR.textLight : SR.textMuted,
                      border: 'none', transition: 'background 120ms', textTransform: 'capitalize',
                    }}
                  >
                    {mode === 'text' ? 'List' : 'Images'}
                  </Box>
                ))}
              </Box>
              {hasPending && (
                <Button variant="contained" size="small" onClick={() => setCommitOpen(true)} sx={{ fontSize: 11 }}>
                  Commit
                </Button>
              )}
            </Box>
          </Box>

          {/* Stat bar */}
          <Box sx={{ display: 'flex', border: `0.5px solid ${SR.border}`, borderRadius: '7px', overflow: 'hidden', mb: 0 }}>
            {[
              { label: 'Cards', value: totalCards, accent: undefined },
              { label: 'Spells', value: spellCount, accent: undefined },
              { label: 'Lands', value: landCount, accent: undefined },
              { label: 'Branches', value: deck?.allBranches?.length ?? 1, accent: SR.accentTealLight },
            ].map((s, i, arr) => (
              <Box key={s.label} sx={{
                flex: 1, backgroundColor: SR.surfacePanel, padding: '9px 14px',
                borderRight: i < arr.length - 1 ? `0.5px solid ${SR.border}` : 'none',
              }}>
                <Box sx={{ fontFamily: SR.fontMono, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: SR.textFaint, mb: '4px' }}>
                  {s.label}
                </Box>
                <Box sx={{ fontFamily: SR.fontDisplay, fontSize: 18, fontWeight: 600, color: s.accent ?? SR.textPrimary }}>
                  {s.value}
                </Box>
              </Box>
            ))}
            <Box
              onClick={() => setSearchOpen(o => !o)}
              sx={{
                width: 46, flexShrink: 0, cursor: 'pointer',
                backgroundColor: searchOpen ? SR.surfaceInk : SR.surfacePanel,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '0 7px 7px 0', transition: 'background 120ms',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
                stroke={searchOpen ? SR.accentTealLight : SR.textMuted}
                strokeWidth="1.5" strokeLinecap="round"
              >
                <circle cx="6.5" cy="6.5" r="5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" />
                {!searchOpen && <><line x1="6.5" y1="4" x2="6.5" y2="9" /><line x1="4" y1="6.5" x2="9" y2="6.5" /></>}
              </svg>
            </Box>
          </Box>

          {/* Board tabs */}
          <Box sx={{ display: 'flex', mt: '10px', mb: '-0.5px' }}>
            {([
              { id: 'main' as const, label: 'Main', count: mainCards.length + commanderCards.length },
              { id: 'side' as const, label: 'Sideboard', count: sideCards.length },
              { id: 'considering' as const, label: 'Considering', count: consideringCards.length },
            ]).map(tab => (
              <Box
                key={tab.id}
                component="button"
                onClick={() => setActiveBoard(tab.id)}
                sx={{
                  fontFamily: SR.fontUi, fontSize: 11, padding: '6px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeBoard === tab.id ? SR.textPrimary : SR.textFaint,
                  borderBottom: `1.5px solid ${activeBoard === tab.id ? SR.accentTealLight : 'transparent'}`,
                  transition: 'color 120ms',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 10, color: SR.textFaint }}>
                    {tab.count}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

        </Box>

        {/* Deck content */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {viewMode === 'text' && (
            <CardListView
              activeBoard={activeBoard}
              main={boardPacks.main}
              commander={boardPacks.commander}
              side={boardPacks.side}
              considering={boardPacks.considering}
              pendingChanges={pendingChanges}
              onAddOne={stageAdd}
              onRemoveOne={stageRemove}
              onRemoveAll={stageRemoveAll}
              onOpenSetCount={openSetCount}
              onSetPortrait={handleSetPortrait}
              onMove={stageMove}
            />
          )}
          {viewMode === 'images' && (
            <ImagesView
              activeBoard={activeBoard}
              main={boardPacks.main}
              commander={boardPacks.commander}
              side={boardPacks.side}
              considering={boardPacks.considering}
              pendingChanges={pendingChanges}
              onAddOne={stageAdd}
              onRemoveOne={stageRemove}
              onRemoveAll={stageRemoveAll}
              onOpenSetCount={openSetCount}
              onSetPortrait={handleSetPortrait}
              onMove={stageMove}
            />
          )}
        </Box>
      </Box>

      {/* ── Right: Search drawer ────────────────────────────────────────────── */}
      <SearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentCards={[...mainCards, ...commanderCards, ...sideCards, ...consideringCards]}
        pendingChanges={pendingChanges}
        onAdd={stageAdd}
        onRemove={(id) => stageRemove(id, 'MAIN')}
        onUndo={undoChange}
      />

      {/* ── Portrait picker dialog ─────────────────────────────────────────── */}
      {(() => {
        const pickerCards = [...commanderCards, ...mainCards, ...addedToMain].filter(
          (c, i, arr) => c.artCropUrl && arr.findIndex(x => x.id === c.id) === i
        );
        return (
          <Dialog open={portraitPickerOpen} onClose={() => setPortraitPickerOpen(false)} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontFamily: SR.fontUi, fontSize: 14, pb: 1 }}>Choose Deck Portrait</DialogTitle>
            <DialogContent sx={{ pt: '8px !important' }}>
              {pickerCards.length === 0 ? (
                <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint, py: 2 }}>
                  No cards with art available.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {pickerCards.map(card => (
                    <Box
                      key={card.id}
                      onClick={() => { handleSetPortrait(card.artCropUrl!); setPortraitPickerOpen(false); }}
                      sx={{
                        cursor: 'pointer', borderRadius: '6px', overflow: 'hidden',
                        border: deck?.portraitUrl === card.artCropUrl ? `1.5px solid ${SR.accentTealLight}` : `0.5px solid ${SR.border}`,
                        '&:hover': { borderColor: SR.textMuted }, transition: 'border-color 120ms',
                      }}
                    >
                      <Box component="img" src={card.artCropUrl!} alt={cardDisplayName(card)}
                        sx={{ width: '100%', display: 'block', aspectRatio: '626 / 457', objectFit: 'cover' }} />
                      <Box sx={{ padding: '6px 10px', fontFamily: SR.fontUi, fontSize: 11, color: SR.textMuted, backgroundColor: SR.surfacePanel, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cardDisplayName(card)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPortraitPickerOpen(false)} variant="outlined">Cancel</Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* ── Set count dialog ────────────────────────────────────────────────── */}
      <Dialog open={Boolean(setCountTarget)} onClose={() => setSetCountTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: SR.fontUi, fontSize: 14, pb: 1 }}>Set Count</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField
            autoFocus fullWidth type="number" label="Copies"
            value={setCountInput}
            onChange={e => setSetCountInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetCount()}
            inputProps={{ min: 0 }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetCountTarget(null)} variant="outlined">Cancel</Button>
          <Button variant="contained" onClick={handleSetCount}
            disabled={isNaN(parseInt(setCountInput, 10)) || parseInt(setCountInput, 10) < 0}
          >Set</Button>
        </DialogActions>
      </Dialog>

      {/* ── Commit dialog ───────────────────────────────────────────────────── */}
      <Dialog open={commitOpen} onClose={() => setCommitOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Commit Changes</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Describe your changes"
            value={commitDesc}
            onChange={e => setCommitDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commitDesc.trim() && handleCommit()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommitOpen(false)} variant="outlined">Cancel</Button>
          <Button variant="contained" disabled={!commitDesc.trim() || commitMutation.isPending} onClick={handleCommit}>
            {commitMutation.isPending ? 'Committing…' : 'Commit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Decklist;
