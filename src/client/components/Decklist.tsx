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

import CardImage, { Card, CardArt, cardDisplayName } from './CardImage';
import CommitGraph from './decklist/CommitGraph';
import type { Commit } from './decklist/CommitGraph';
import ArtBanner from './decklist/ArtBanner';
import CardListView from './decklist/CardListView';
import type { BoardKey, BoardPack } from './decklist/CardListView';
import { BOARD_LABELS, buildTypeGroups } from './decklist/CardListView';
import type { CountedCard, GroupDef } from './decklist/CardListView';
import SearchDrawer from './decklist/SearchDrawer';
import { buildGraph, buildBranchColors } from './decklist/graphUtils';
import type { GraphBranch } from './decklist/graphUtils';
import { SR } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type BoardDeltas = Partial<Record<BoardKey, number>>;

interface WorkingTreeMeta { lastModifiedAt: string; isCurrentSession: boolean; stagedChanges: StagedChangeRecord[]; }
interface Branch { id: string; name: string; headCommitId: string | null; decklist: DecklistState; commits: Commit[]; workingTree: WorkingTreeMeta | null; }

type SyncChange =
  | { action: 'ADD' | 'REMOVE'; board: BoardKey; cardId: string; count: number }
  | { action: 'SET_ART'; cardId: string; artId: string };

type StagedChangeRecord =
  | { action: 'ADD' | 'REMOVE'; board: BoardKey; cardId: string; count: number; card: Card }
  | { action: 'SET_ART'; cardId: string; artId: string | null; card: Card; cardArt: CardArt | null };

function pendingChangesToSync(changes: Map<string, BoardDeltas>, artChanges: Map<string, CardArt>): SyncChange[] {
  const result: SyncChange[] = [];
  changes.forEach((boardDeltas, cardId) => {
    (Object.entries(boardDeltas) as [BoardKey, number][]).forEach(([board, delta]) => {
      if (delta === 0) return;
      result.push({ action: delta > 0 ? 'ADD' : 'REMOVE', board, cardId, count: Math.abs(delta) });
    });
  });
  artChanges.forEach((art, cardId) => {
    result.push({ action: 'SET_ART', cardId, artId: art.id });
  });
  return result;
}
interface DecklistState { mainDeck: Card[]; sideBoard: Card[]; commander: Card[]; considering: Card[]; artPreferences?: Record<string, CardArt>; }
interface Deck {
  id: string; name: string;
  portraitUrl: string | null;
  branches: Branch[];
  allBranches: { id: string; name: string }[];
  graphBranches: GraphBranch[];
  artPreferences?: Record<string, CardArt>;
}

const ALL_BOARDS: BoardKey[] = ['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING'];

// ── Deck text format parser ────────────────────────────────────────────────────

interface ParsedCard { name: string; count: number; board: BoardKey; }

const SECTION_HEADERS: Record<string, BoardKey> = {
  'deck': 'MAIN', 'main': 'MAIN', 'mainboard': 'MAIN', 'main deck': 'MAIN',
  'sideboard': 'SIDE', 'side': 'SIDE', 'sb': 'SIDE', 'side board': 'SIDE',
  'commander': 'COMMANDER', 'commanders': 'COMMANDER',
  'maybeboard': 'CONSIDERING', 'maybe': 'CONSIDERING', 'considering': 'CONSIDERING',
};

function parseDeckText(text: string): { cards: ParsedCard[]; skipped: string[] } {
  let currentBoard: BoardKey = 'MAIN';
  const cards: ParsedCard[] = [];
  const skipped: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower === 'about' || lower.startsWith('name ') || line.startsWith('//')) continue;
    if (SECTION_HEADERS[lower] !== undefined) { currentBoard = SECTION_HEADERS[lower]; continue; }

    // "4 Card Name" or "4x Card Name", optionally followed by "(SET) 123"
    const m = line.match(/^(\d+)[xX]?\s+(.+?)(?:\s+\([^)]+\)(?:\s+\d+)?)?$/);
    if (m) { cards.push({ name: m[2].trim(), count: parseInt(m[1], 10), board: currentBoard }); continue; }

    skipped.push(line);
  }
  return { cards, skipped };
}

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
  card, art, effective, committed, board,
  onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove,
}: {
  card: Card;
  art?: CardArt | null;
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
      <CardImage card={card} art={art} dimmed={pendingAdded && committed === 0} />

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
        {onSetPortrait && art?.artCropUrl && [
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


const ImagesView = ({
  activeBoard, main, commander, side, considering,
  pendingChanges, resolveArt, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount, onSetPortrait, onMove,
}: {
  activeBoard: 'main' | 'side' | 'considering';
  main: BoardPack;
  commander: BoardPack;
  side: BoardPack;
  considering: BoardPack;
  pendingChanges: Map<string, BoardDeltas>;
  resolveArt?: (card: Card) => CardArt | null;
  onAddOne: (card: Card, board: BoardKey) => void;
  onRemoveOne: (id: string, board: BoardKey) => void;
  onRemoveAll: (id: string, board: BoardKey) => void;
  onOpenSetCount: (id: string, board: BoardKey) => void;
  onSetPortrait: (url: string) => void;
  onMove: (card: Card, fromBoard: BoardKey, toBoard: BoardKey) => void;
}) => {
  type DedupedItem = { card: Card; committed: number; board: BoardKey; effective: number; resolvedArt: CardArt | null };

  const toItems = (counted: CountedCard[], board: BoardKey): DedupedItem[] =>
    counted.map(({ card, count }) => ({
      card, committed: count, board,
      effective: count + (pendingChanges.get(card.id)?.[board] ?? 0),
      resolvedArt: resolveArt ? resolveArt(card) : (card.defaultArt ?? null),
    }));

  const Section = ({ title, items, board }: { title: string; items: DedupedItem[]; board: BoardKey }) => (
    <Box sx={{ mb: '24px' }}>
      <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: SR.textFaint, mb: '10px' }}>
        {title}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))', gap: '12px' }}>
        {items.map(({ card, committed, effective, resolvedArt }) => (
          <ImageCardItem
            key={card.id}
            card={card}
            art={resolvedArt}
            effective={effective}
            committed={committed}
            board={board}
            onAddOne={() => onAddOne(card, board)}
            onRemoveOne={() => onRemoveOne(card.id, board)}
            onRemoveAll={() => onRemoveAll(card.id, board)}
            onOpenSetCount={() => onOpenSetCount(card.id, board)}
            onSetPortrait={resolvedArt?.artCropUrl ? () => onSetPortrait(resolvedArt!.artCropUrl!) : undefined}
            onMove={toBoard => onMove(card, board, toBoard)}
          />
        ))}
      </Box>
    </Box>
  );

  const cmdExclude = new Set(commander.committed.map(c => c.id));
  const cmdGroups = buildTypeGroups(commander.committed, commander.added, 'COMMANDER', new Set());
  const cmdItems = cmdGroups.flatMap(g => toItems(g.counted, 'COMMANDER'));

  if (activeBoard === 'main') {
    const mainGroups = buildTypeGroups(main.committed, main.added, 'MAIN', cmdExclude);
    return (
      <Box sx={{ padding: '20px 28px' }}>
        {cmdItems.length > 0 && <Section title="Commanders" items={cmdItems} board="COMMANDER" />}
        {mainGroups.map(g => (
          <Section key={g.key} title={g.label} items={toItems(g.counted, 'MAIN')} board="MAIN" />
        ))}
      </Box>
    );
  }
  if (activeBoard === 'side') {
    const sideGroups = buildTypeGroups(side.committed, side.added, 'SIDE', new Set());
    if (!sideGroups.length) return <Box sx={{ padding: '40px 28px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>No cards in sideboard.</Box>;
    return (
      <Box sx={{ padding: '20px 28px' }}>
        {sideGroups.map(g => (
          <Section key={g.key} title={g.label} items={toItems(g.counted, 'SIDE')} board="SIDE" />
        ))}
      </Box>
    );
  }
  const consideringGroups = buildTypeGroups(considering.committed, considering.added, 'CONSIDERING', new Set());
  if (!consideringGroups.length) return <Box sx={{ padding: '40px 28px', fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint }}>No cards in considering.</Box>;
  return (
    <Box sx={{ padding: '20px 28px' }}>
      {consideringGroups.map(g => (
        <Section key={g.key} title={g.label} items={toItems(g.counted, 'CONSIDERING')} board="CONSIDERING" />
      ))}
    </Box>
  );
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
  const [sessionConflict, setSessionConflict] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchNameInput, setBranchNameInput] = useState('');

  // Board-aware pending changes: cardId → per-board net deltas
  const [pendingChanges, setPendingChanges] = useState<Map<string, BoardDeltas>>(new Map());
  // Art changes pending commit: cardId → CardArt selected
  const [pendingArtChanges, setPendingArtChanges] = useState<Map<string, CardArt>>(new Map());
  const [artPickerCard, setArtPickerCard] = useState<Card | null>(null);

  const hasPending = pendingChanges.size > 0 || pendingArtChanges.size > 0;

  // ── Working tree sync ────────────────────────────────────────────────────────

  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncMutation = useMutation({
    mutationFn: ({ bid, changes }: { bid: string; changes: SyncChange[] }) =>
      axios.put(`/api/deck/${id}/${bid}/working-tree`, { changes }),
    onSuccess: (res) => {
      if (res.data.conflict) setSessionConflict(true);
    },
  });

  const quickCommitMutation = useMutation({
    mutationFn: ({ bid }: { bid: string }) =>
      axios.post(`/api/deck/${id}/${bid}/quick-commit`),
    onSuccess: () => {
      setPendingChanges(new Map());
      setPendingArtChanges(new Map());
      setSessionConflict(false);
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
    },
  });

  const isViewingHistory = Boolean(selectedCommit && selectedCommit !== headCommitId);

  const historicalQ = useQuery<{ data: DecklistState }>({
    queryKey: ['commitSnapshot', id, branchId, selectedCommit],
    queryFn: () => axios.get(`/api/deck/${id}/${branchId}/${selectedCommit}`),
    enabled: isViewingHistory && Boolean(branchId && selectedCommit),
  });

  // Server-side art preferences (oracleId → CardArt)
  const artPreferences: Record<string, CardArt> = deck?.artPreferences ?? {};

  // Art picker lazy query — only fetches when picker is open
  const artPickerQ = useQuery<CardArt[]>({
    queryKey: ['cardArts', artPickerCard?.oracleId],
    queryFn: () =>
      axios.get<CardArt[]>(`/api/scryfall/arts?oracleId=${artPickerCard!.oracleId}`).then(r => r.data),
    enabled: Boolean(artPickerCard?.oracleId),
    staleTime: 5 * 60 * 1000,
  });

  const resolveArt = (card: Card): CardArt | null => {
    if (isViewingHistory) {
      const histPrefs = historicalQ.data?.data?.artPreferences;
      if (histPrefs && card.oracleId && histPrefs[card.oracleId]) return histPrefs[card.oracleId];
      return card.defaultArt ?? null;
    }
    const pending = pendingArtChanges.get(card.id);
    if (pending) return pending;
    if (card.oracleId && artPreferences[card.oracleId]) return artPreferences[card.oracleId];
    return card.defaultArt ?? null;
  };

  const handleSelectArt = (art: CardArt) => {
    if (!artPickerCard) return;
    const n = new Map(pendingArtChanges);
    n.set(artPickerCard.id, art);
    setPendingArtChanges(n);
    setArtPickerCard(null);
    debouncedSync(pendingChanges, n);
  };

  const branchMutation = useMutation({
    mutationFn: ({ sourceCommitId, branchName }: { sourceCommitId: string; branchName?: string }) =>
      axios.post<{ branchId: string; branchName: string }>(`/api/deck/${id}/branch`, { sourceCommitId, branchName: branchName || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
      setBranchDialogOpen(false);
      setBranchNameInput('');
      navigate(`/deck/${id}/${res.data.branchId}`);
    },
  });

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNotFound, setImportNotFound] = useState<string[]>([]);

  const importMutation = useMutation({
    mutationFn: ({ bid, cards }: { bid: string; cards: ParsedCard[] }) =>
      axios.post<{ commitId: string | null; notFound: string[] }>(`/api/deck/${id}/${bid}/import`, { cards }),
    onSuccess: (res) => {
      setImportNotFound(res.data.notFound);
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
      if (res.data.notFound.length === 0) { setImportDialogOpen(false); setImportText(''); }
    },
  });

  const handleImport = () => {
    if (!branchId) return;
    const { cards } = parseDeckText(importText);
    if (cards.length === 0) return;
    importMutation.mutate({ bid: branchId, cards });
  };

  const handleExport = () => {
    if (!deck) return;
    const lines: string[] = [];
    const addSection = (title: string, pack: typeof boardPacks.main, board: BoardKey) => {
      const countMap = new Map<string, { card: Card; count: number }>();
      [...pack.committed, ...pack.added].forEach(c => {
        const e = countMap.get(c.id);
        if (e) e.count++; else countMap.set(c.id, { card: c, count: 1 });
      });
      const items = [...countMap.values()].map(({ card, count }) => ({
        card, effective: count + (displayPendingChanges.get(card.id)?.[board] ?? 0),
      })).filter(({ effective }) => effective > 0);
      if (!items.length) return;
      lines.push(title);
      items.forEach(({ card, effective }) => lines.push(`${effective} ${card.name}`));
      lines.push('');
    };
    addSection('Commander', boardPacks.commander, 'COMMANDER');
    addSection('Deck', boardPacks.main, 'MAIN');
    addSection('Sideboard', boardPacks.side, 'SIDE');
    addSection('Considering', boardPacks.considering, 'CONSIDERING');
    const blob = new Blob([lines.join('\n').trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name}-${currentBranch?.name ?? 'main'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const debouncedSync = (newChanges: Map<string, BoardDeltas>, newArtChanges: Map<string, CardArt> = pendingArtChanges) => {
    if (!branchId) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const changes = pendingChangesToSync(newChanges, newArtChanges);
    syncTimerRef.current = setTimeout(() => {
      syncMutation.mutate({ bid: branchId, changes });
    }, 300);
  };

  useEffect(() => {
    if (headCommitId) setSelectedCommit(headCommitId);
  }, [headCommitId]);

  useEffect(() => {
    const staged = currentBranch?.workingTree?.stagedChanges;
    if (!staged?.length) {
      setPendingChanges(new Map());
      setPendingArtChanges(new Map());
      return;
    }
    const map = new Map<string, BoardDeltas>();
    const artMap = new Map<string, CardArt>();
    staged.forEach((sc) => {
      if (sc.action === 'SET_ART') {
        if (sc.cardArt) artMap.set(sc.cardId, sc.cardArt);
        return;
      }
      queryClient.setQueryData(['card', sc.cardId], sc.card);
      const existing = map.get(sc.cardId) ?? {};
      const delta = sc.action === 'ADD' ? sc.count : -sc.count;
      map.set(sc.cardId, { ...existing, [sc.board]: (existing[sc.board] ?? 0) + delta });
    });
    setPendingChanges(map);
    setPendingArtChanges(artMap);
  }, [currentBranch?.id]);

  // ── Board helpers ────────────────────────────────────────────────────────────

  const getBoardCards = (board: BoardKey): Card[] => ({
    MAIN: mainCards,
    SIDE: sideCards,
    COMMANDER: commanderCards,
    CONSIDERING: consideringCards,
  }[board]);

  const updateBoardDelta = (cardId: string, board: BoardKey, amount: number) => {
    if (isViewingHistory) { setBranchDialogOpen(true); return; }
    const n = new Map(pendingChanges);
    const existing = n.get(cardId) ?? {};
    const next = (existing[board] ?? 0) + amount;
    const updated = { ...existing };
    if (next === 0) delete updated[board]; else updated[board] = next;
    if (Object.keys(updated).length === 0) n.delete(cardId);
    else n.set(cardId, updated);
    setPendingChanges(n);
    debouncedSync(n);
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
    if (isViewingHistory) { setBranchDialogOpen(true); return; }
    queryClient.setQueryData(['card', card.id], card);
    const n = new Map(pendingChanges);
    const existing = n.get(card.id) ?? {};
    const updated = { ...existing };
    const fromNext = (updated[fromBoard] ?? 0) - 1;
    if (fromNext === 0) delete updated[fromBoard]; else updated[fromBoard] = fromNext;
    const toNext = (updated[toBoard] ?? 0) + 1;
    if (toNext === 0) delete updated[toBoard]; else updated[toBoard] = toNext;
    if (Object.keys(updated).length === 0) n.delete(card.id);
    else n.set(card.id, updated);
    setPendingChanges(n);
    debouncedSync(n);
  };

  const stageRemoveAll = (id: string, board: BoardKey) => {
    if (isViewingHistory) { setBranchDialogOpen(true); return; }
    const committed = getBoardCards(board).filter(c => c.id === id).length;
    const n = new Map(pendingChanges);
    const existing = n.get(id) ?? {};
    const updated = { ...existing };
    if (committed === 0) delete updated[board]; else updated[board] = -committed;
    if (Object.keys(updated).length === 0) n.delete(id);
    else n.set(id, updated);
    setPendingChanges(n);
    debouncedSync(n);
  };

  const undoChange = (id: string) => {
    const n = new Map(pendingChanges);
    n.delete(id);
    setPendingChanges(n);
    debouncedSync(n);
  };

  // ── Set count dialog ─────────────────────────────────────────────────────────

  const [setCountTarget, setSetCountTarget] = useState<{ id: string; board: BoardKey; effective: number } | null>(null);
  const [setCountInput, setSetCountInput] = useState('');

  const openSetCount = (id: string, board: BoardKey) => {
    if (isViewingHistory) { setBranchDialogOpen(true); return; }
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
    const n = new Map(pendingChanges);
    const existing = n.get(id) ?? {};
    const updated = { ...existing };
    if (delta === 0) delete updated[board]; else updated[board] = delta;
    if (Object.keys(updated).length === 0) n.delete(id);
    else n.set(id, updated);
    setPendingChanges(n);
    debouncedSync(n);
    setSetCountTarget(null);
  };

  const handleQuickCommit = async () => {
    if (!branchId) return;
    // Flush debounced sync immediately before committing
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const changes = pendingChangesToSync(pendingChanges, pendingArtChanges);
    await syncMutation.mutateAsync({ bid: branchId, changes });
    await quickCommitMutation.mutateAsync({ bid: branchId });
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
    [...pendingChanges.entries()].flatMap(([cid, boardDeltas]): { action: 'ADD' | 'REMOVE' | 'MOVE'; cardName: string }[] => {
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
      autoPortrait = portraitCard ? (resolveArt(portraitCard)?.artCropUrl ?? null) : null;
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

  // ── Historical display override ───────────────────────────────────────────────

  const historicalDecklist = historicalQ.data?.data;
  const displayMain = isViewingHistory ? (historicalDecklist?.mainDeck ?? []) : mainCards;
  const displayCommander = isViewingHistory ? (historicalDecklist?.commander ?? []) : commanderCards;
  const displaySide = isViewingHistory ? (historicalDecklist?.sideBoard ?? []) : sideCards;
  const displayConsidering = isViewingHistory ? (historicalDecklist?.considering ?? []) : consideringCards;
  const displayPendingChanges = isViewingHistory ? new Map<string, BoardDeltas>() : pendingChanges;

  // ── Derived stats (main + commander board) ───────────────────────────────────

  const mainDelta = isViewingHistory ? 0 : [...pendingChanges.values()].reduce((s, b) => s + (b.MAIN ?? 0), 0);
  const cmdDelta = isViewingHistory ? 0 : [...pendingChanges.values()].reduce((s, b) => s + (b.COMMANDER ?? 0), 0);
  const totalCards = displayMain.length + displayCommander.length + mainDelta + cmdDelta;
  const spellCount = [...displayMain, ...(isViewingHistory ? [] : addedToMain)].filter(c => !c.typeLine?.includes('Land')).length;
  const landCount = [...displayMain, ...(isViewingHistory ? [] : addedToMain)].filter(c => c.typeLine?.includes('Land')).length;

  const pendingCount = [...pendingChanges.values()].reduce((sum, boards) =>
    sum + Object.values(boards).reduce((a, b) => a + Math.abs(b), 0), 0
  ) + pendingArtChanges.size;

  // ── Board packs ───────────────────────────────────────────────────────────────

  const boardPacks: Record<'main' | 'side' | 'commander' | 'considering', BoardPack> = {
    main: { committed: displayMain, added: isViewingHistory ? [] : addedToMain },
    commander: { committed: displayCommander, added: isViewingHistory ? [] : addedToCommander },
    side: { committed: displaySide, added: isViewingHistory ? [] : addedToSide },
    considering: { committed: displayConsidering, added: isViewingHistory ? [] : addedToConsidering },
  };

  const selectedCommitData = commits.find(c => c.id === selectedCommit);

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
                {hasPending && (() => {
                  const wt = currentBranch?.workingTree;
                  const showMeta = wt && !wt.isCurrentSession;
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                        {pendingCount} uncommitted change{pendingCount !== 1 ? 's' : ''}
                      </Box>
                      {showMeta && (
                        <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 10, color: SR.textFaint, fontStyle: 'italic' }}>
                          Last modified {new Date(wt.lastModifiedAt).toLocaleDateString()} at {new Date(wt.lastModifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Box>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button size="small" variant="outlined" onClick={() => { setImportNotFound([]); setImportDialogOpen(true); }} sx={{ fontSize: 11 }}>Import</Button>
              <Button size="small" variant="outlined" onClick={handleExport} sx={{ fontSize: 11 }}>Export</Button>
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
                <>
                  <Button
                    variant="outlined" size="small"
                    onClick={handleQuickCommit}
                    disabled={quickCommitMutation.isPending || syncMutation.isPending}
                    sx={{ fontSize: 11 }}
                  >
                    {quickCommitMutation.isPending ? 'Committing…' : 'Quick Commit'}
                  </Button>
                  <Button variant="contained" size="small" onClick={() => setCommitOpen(true)} sx={{ fontSize: 11 }}>
                    Commit
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* History banner */}
          {isViewingHistory && (
            <Box sx={{
              mb: '8px', px: '12px', py: '8px', borderRadius: '5px',
              backgroundColor: SR.surfacePanel, border: `0.5px solid ${SR.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 10, color: SR.accentGold, flexShrink: 0 }}>
                  {selectedCommit?.slice(0, 7)}
                </Box>
                <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedCommitData?.description ?? ''}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <Button size="small" variant="outlined"
                  onClick={() => setSelectedCommit(headCommitId)}
                  sx={{ fontSize: 10 }}
                >
                  Return to HEAD
                </Button>
                <Button size="small" variant="contained"
                  onClick={() => setBranchDialogOpen(true)}
                  disabled={branchMutation.isPending}
                  sx={{ fontSize: 10 }}
                >
                  Branch from here
                </Button>
              </Box>
            </Box>
          )}

          {/* Session conflict warning */}
          {sessionConflict && (
            <Box sx={{
              mb: '8px', px: '12px', py: '6px', borderRadius: '5px',
              backgroundColor: 'rgba(180,130,30,0.12)', border: `0.5px solid ${SR.accentGoldBorder}`,
              fontFamily: SR.fontUi, fontSize: 11, color: SR.accentGold,
            }}>
              Another session has made changes to this deck. Your edits have been merged.
            </Box>
          )}

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
              pendingChanges={displayPendingChanges}
              resolveArt={resolveArt}
              onAddOne={stageAdd}
              onRemoveOne={stageRemove}
              onRemoveAll={stageRemoveAll}
              onOpenSetCount={openSetCount}
              onSetPortrait={handleSetPortrait}
              onSelectArt={isViewingHistory ? undefined : setArtPickerCard}
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
              pendingChanges={displayPendingChanges}
              resolveArt={resolveArt}
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
        const pickerCards = [...commanderCards, ...mainCards, ...addedToMain]
          .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
          .filter(c => Boolean(resolveArt(c)?.artCropUrl));
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
                  {pickerCards.map(card => {
                    const cropUrl = resolveArt(card)!.artCropUrl!;
                    return (
                      <Box
                        key={card.id}
                        onClick={() => { handleSetPortrait(cropUrl); setPortraitPickerOpen(false); }}
                        sx={{
                          cursor: 'pointer', borderRadius: '6px', overflow: 'hidden',
                          border: deck?.portraitUrl === cropUrl ? `1.5px solid ${SR.accentTealLight}` : `0.5px solid ${SR.border}`,
                          '&:hover': { borderColor: SR.textMuted }, transition: 'border-color 120ms',
                        }}
                      >
                        <Box component="img" src={cropUrl} alt={cardDisplayName(card)}
                          sx={{ width: '100%', display: 'block', aspectRatio: '626 / 457', objectFit: 'cover' }} />
                        <Box sx={{ padding: '6px 10px', fontFamily: SR.fontUi, fontSize: 11, color: SR.textMuted, backgroundColor: SR.surfacePanel, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cardDisplayName(card)}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPortraitPickerOpen(false)} variant="outlined">Cancel</Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* ── Art picker dialog ──────────────────────────────────────────────── */}
      <Dialog open={Boolean(artPickerCard)} onClose={() => setArtPickerCard(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily: SR.fontUi, fontSize: 14, pb: 1 }}>
          Select Art — {artPickerCard ? cardDisplayName(artPickerCard) : ''}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {artPickerQ.isFetching ? (
            <Typography sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.textFaint, py: 2 }}>Loading arts…</Typography>
          ) : !artPickerCard?.oracleId ? (
            <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint, py: 2 }}>No oracle ID — cannot look up alternate arts.</Typography>
          ) : (artPickerQ.data ?? []).length === 0 ? (
            <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textFaint, py: 2 }}>
              No alternate art found. Run the arts download to import additional printings.
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {(artPickerQ.data ?? []).map(art => {
                const cropUrl = art.faces?.[0]?.artCropUrl ?? art.artCropUrl;
                const currentArtId = artPickerCard ? resolveArt(artPickerCard)?.id : null;
                const isSelected = art.id === currentArtId;
                return (
                  <Box
                    key={art.id}
                    onClick={() => handleSelectArt(art)}
                    sx={{
                      cursor: 'pointer', borderRadius: '6px', overflow: 'hidden',
                      border: isSelected ? `1.5px solid ${SR.accentTealLight}` : `0.5px solid ${SR.border}`,
                      '&:hover': { borderColor: SR.textMuted },
                      transition: 'border-color 120ms',
                    }}
                  >
                    {cropUrl ? (
                      <Box component="img" src={cropUrl} alt={art.name}
                        sx={{ width: '100%', display: 'block', aspectRatio: '626 / 457', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: '100%', aspectRatio: '626 / 457', backgroundColor: SR.surfaceCard, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ color: SR.textFaint }}>No image</Typography>
                      </Box>
                    )}
                    <Box sx={{ padding: '6px 10px', backgroundColor: SR.surfacePanel }}>
                      <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {art.setName ?? art.set ?? ''}
                      </Box>
                      <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, color: SR.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {art.artist ?? ''}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArtPickerCard(null)} variant="outlined">Cancel</Button>
        </DialogActions>
      </Dialog>

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

      {/* ── Import dialog ──────────────────────────────────────────────────── */}
      <Dialog open={importDialogOpen} onClose={() => { setImportDialogOpen(false); setImportText(''); setImportNotFound([]); }} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontFamily: SR.fontUi, fontSize: 14, pb: 1 }}>Import Decklist</DialogTitle>
        <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Typography sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.textMuted }}>
            Paste a deck list below. Supports Moxfield, MTGO, and Arena formats.
          </Typography>
          <TextField
            multiline fullWidth rows={14}
            placeholder={'Commander\n1 Sol Ring\n\nDeck\n4 Lightning Bolt\n1 Mountain\n\nSideboard\n2 Negate'}
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportNotFound([]); }}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
          />
          {(() => {
            const { cards } = parseDeckText(importText);
            if (!importText.trim()) return null;
            return (
              <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                {cards.length} card entr{cards.length !== 1 ? 'ies' : 'y'} parsed
              </Box>
            );
          })()}
          {importNotFound.length > 0 && (
            <Box sx={{ p: '10px 12px', borderRadius: '5px', backgroundColor: 'rgba(180,60,40,0.1)', border: `0.5px solid ${SR.accentRed}` }}>
              <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.accentRed, mb: '6px' }}>
                {importNotFound.length} card{importNotFound.length !== 1 ? 's' : ''} not found in collection:
              </Box>
              <Box sx={{ fontFamily: SR.fontMono, fontSize: 11, color: SR.textMuted, whiteSpace: 'pre-wrap' }}>
                {importNotFound.join('\n')}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialogOpen(false); setImportText(''); setImportNotFound([]); }} variant="outlined">Cancel</Button>
          <Button
            variant="contained"
            disabled={importMutation.isPending || parseDeckText(importText).cards.length === 0}
            onClick={handleImport}
          >
            {importMutation.isPending ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Branch from commit dialog ──────────────────────────────────────── */}
      <Dialog open={branchDialogOpen} onClose={() => setBranchDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: SR.fontUi, fontSize: 14, pb: 1 }}>Branch from this commit</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.textMuted, mb: 2 }}>
            {isViewingHistory
              ? `Create a new branch from commit ${selectedCommit?.slice(0, 7)}.`
              : 'Create a new branch to make changes from this point.'}
          </Typography>
          <TextField
            autoFocus fullWidth label="Branch name (optional)"
            value={branchNameInput}
            onChange={e => setBranchNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !branchMutation.isPending && selectedCommit && branchMutation.mutate({ sourceCommitId: selectedCommit, branchName: branchNameInput })}
            placeholder="auto-generated from commit"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBranchDialogOpen(false); setBranchNameInput(''); }} variant="outlined">Cancel</Button>
          <Button
            variant="contained"
            disabled={branchMutation.isPending || !selectedCommit}
            onClick={() => selectedCommit && branchMutation.mutate({ sourceCommitId: selectedCommit, branchName: branchNameInput })}
          >
            {branchMutation.isPending ? 'Creating…' : 'Create Branch'}
          </Button>
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
