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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CardImage, { Card, cardDisplayName } from './CardImage';
import type { Commit } from './CommitHistory';
import CommitGraph from './decklist/CommitGraph';
import ArtBanner from './decklist/ArtBanner';
import CardListView from './decklist/CardListView';
import SearchDrawer from './decklist/SearchDrawer';
import { buildGraph, buildBranchColors } from './decklist/graphUtils';
import type { GraphBranch } from './decklist/graphUtils';
import { SR } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DecklistState { mainDeck: Card[]; sideBoard: Card[]; commander: Card[]; }
interface Branch { id: string; name: string; headCommitId: string | null; decklist: DecklistState; commits: Commit[]; }
interface Deck {
  id: string; name: string;
  portraitUrl: string | null;
  branches: Branch[];
  allBranches: { id: string; name: string }[];
  graphBranches: GraphBranch[];
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


// ── Images view ───────────────────────────────────────────────────────────────

const ImagesView = ({
  commanders, mainCards, addedCards, pendingAdds, pendingRemoves, onRemove, onUndo, onSetPortrait,
}: {
  commanders: Card[];
  mainCards: Card[];
  addedCards: Card[];
  pendingAdds: Set<string>;
  pendingRemoves: Set<string>;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
  onSetPortrait: (url: string) => void;
}) => {
  const allCards = [...mainCards, ...addedCards.filter(ac => !mainCards.some(c => c.id === ac.id))];
  const spells = allCards.filter(c => !c.typeLine?.includes('Land'));
  const lands = allCards.filter(c => c.typeLine?.includes('Land'));

  const overlayBtnSx = {
    borderRadius: '4px', padding: '4px 10px',
    fontFamily: SR.fontUi, fontSize: 10, cursor: 'pointer',
  };

  const renderCard = (card: Card, i: number) => {
    const removing = pendingRemoves.has(card.id);
    const added = pendingAdds.has(card.id);
    const isPending = removing || added;

    const hoverAction = !isPending ? (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        {card.artCropUrl && (
          <Box
            component="button"
            onClick={() => onSetPortrait(card.artCropUrl!)}
            title="Set as deck portrait"
            sx={{
              ...overlayBtnSx,
              backgroundColor: 'rgba(30,34,40,0.85)',
              border: `0.5px solid rgba(255,255,255,0.2)`,
              color: SR.textLight,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
              <circle cx="4.5" cy="4.5" r="1.5" />
              <path d="M1 8.5 L3.5 6.5 L5.5 8 L8 5.5 L11 8.5" />
            </svg>
            portrait
          </Box>
        )}
        <Box
          component="button"
          onClick={() => onRemove(card.id)}
          sx={{
            ...overlayBtnSx,
            backgroundColor: SR.accentRedBg,
            border: `0.5px solid ${SR.accentRed}`,
            color: SR.accentRed,
          }}
        >
          remove
        </Box>
      </Box>
    ) : undefined;

    return (
      <Box key={`${card.id}-${i}`} sx={{ position: 'relative', borderRadius: '8px' }}>
        <CardImage card={card} dimmed={added} action={hoverAction} />
        {removing && (
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '8px',
            backgroundColor: 'rgba(122,48,40,0.22)', pointerEvents: 'none',
          }} />
        )}
        {isPending && (
          <Box
            component="button"
            onClick={() => onUndo(card.id)}
            sx={{
              ...overlayBtnSx, position: 'absolute', top: '8px', right: '8px', zIndex: 1,
              backgroundColor: removing ? SR.accentRedBg : SR.surfacePanel,
              border: `0.5px solid ${removing ? SR.accentRed : SR.border}`,
              color: removing ? SR.accentRed : SR.textMuted,
            }}
          >
            undo
          </Box>
        )}
      </Box>
    );
  };

  const Section = ({ title, cards }: { title: string; cards: Card[] }) => (
    <Box sx={{ mb: '24px' }}>
      <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: SR.textFaint, mb: '10px' }}>
        {title}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))', gap: '12px' }}>
        {cards.map((card, i) => renderCard(card, i))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ padding: '20px 28px' }}>
      {commanders.length > 0 && <Section title="Commanders" cards={commanders} />}
      {spells.length > 0 && <Section title="Spells" cards={spells} />}
      {lands.length > 0 && <Section title="Lands" cards={lands} />}
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
  const commits = currentBranch?.commits ?? [];
  const branchId = currentBranch?.id;
  const headCommitId = currentBranch?.headCommitId ?? null;

  // Graph
  const graphNodes = useMemo(() => buildGraph(deck?.graphBranches ?? []), [deck?.graphBranches]);
  const branchColors = useMemo(() => buildBranchColors(deck?.graphBranches ?? []), [deck?.graphBranches]);

  // UI state
  const [viewMode, setViewMode] = useState<'text' | 'images'>('text');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDesc, setCommitDesc] = useState('');

  // Pending changes
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const hasPending = pendingAdds.size > 0 || pendingRemoves.size > 0;

  // Sync selected commit to HEAD on branch change
  useEffect(() => {
    if (headCommitId) setSelectedCommit(headCommitId);
  }, [headCommitId]);

  // Staging
  const stageAdd = (card: Card) => {
    setPendingRemoves(s => { const n = new Set(s); n.delete(card.id); return n; });
    setPendingAdds(s => new Set(s).add(card.id));
    queryClient.setQueryData(['card', card.id], card);
  };
  const stageRemove = (id: string) => {
    setPendingAdds(s => { const n = new Set(s); n.delete(id); return n; });
    setPendingRemoves(s => new Set(s).add(id));
  };
  const undoChange = (id: string) => {
    setPendingAdds(s => { const n = new Set(s); n.delete(id); return n; });
    setPendingRemoves(s => { const n = new Set(s); n.delete(id); return n; });
  };

  const addedCards: Card[] = [...pendingAdds]
    .filter(cid => !mainCards.some(c => c.id === cid))
    .map(cid => queryClient.getQueryData<Card>(['card', cid])!)
    .filter(Boolean);

  const pendingChanges = [
    ...[...pendingRemoves].map(id => ({
      action: 'REMOVE' as const,
      cardName: mainCards.find(c => c.id === id)?.name ?? id,
    })),
    ...[...pendingAdds].map(id => ({
      action: 'ADD' as const,
      cardName: addedCards.find(c => c.id === id)?.name ?? id,
    })),
  ];

  // Portrait mutation
  const portraitMutation = useMutation({
    mutationFn: (portraitUrl: string) => axios.patch(`/api/deck/${id}/portrait`, { portraitUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deckFetch', id] }),
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: (payload: { description: string; changes: { action: string; board: string; cardId: string }[]; mainDeck: string[]; sideBoard: string[]; portraitUrl?: string | null; }) =>
      axios.post(`/api/deck/${id}/${branchId}`, payload),
    onSuccess: () => {
      setPendingAdds(new Set());
      setPendingRemoves(new Set());
      setCommitOpen(false);
      setCommitDesc('');
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
    },
  });

  const handleCommit = () => {
    const changes = [
      ...[...pendingAdds].map(cardId => ({ action: 'ADD', board: 'MAIN', cardId })),
      ...[...pendingRemoves].map(cardId => ({ action: 'REMOVE', board: 'MAIN', cardId })),
    ];
    const newDeckIds = new Set(mainCards.map(c => c.id));
    pendingAdds.forEach(cid => newDeckIds.add(cid));
    pendingRemoves.forEach(cid => newDeckIds.delete(cid));

    let autoPortrait: string | null | undefined;
    if (!deck?.portraitUrl) {
      const portraitCard = commanderCards[0]
        ?? [...mainCards, ...addedCards].find(c => !pendingRemoves.has(c.id));
      autoPortrait = portraitCard?.artCropUrl ?? null;
    }

    commitMutation.mutate({ description: commitDesc, changes, mainDeck: [...newDeckIds], sideBoard: [], portraitUrl: autoPortrait });
  };

  const handleSetPortrait = (portraitUrl: string) => portraitMutation.mutate(portraitUrl);

  // Derived stats
  const totalCards = mainCards.length + commanderCards.length + pendingAdds.size - pendingRemoves.size;
  const spellCount = [...mainCards, ...addedCards].filter(c => !c.typeLine?.includes('Land') && !pendingRemoves.has(c.id)).length;
  const landCount = [...mainCards, ...addedCards].filter(c => c.typeLine?.includes('Land') && !pendingRemoves.has(c.id)).length;

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
        pendingChanges={pendingChanges}
        selectedHash={selectedCommit}
        onSelect={setSelectedCommit}
      />

      {/* ── Centre: Deck view ───────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Art banner */}
        <ArtBanner deckName={deck?.name ?? ''} portraitUrl={deck?.portraitUrl ?? null} />

        {/* Deck header */}
        <Box sx={{ padding: '14px 20px 0', borderBottom: `0.5px solid ${SR.border}`, flexShrink: 0 }}>

          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: '12px' }}>
            <Box>
              <Box sx={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Branch selector styled as tag */}
                <Box
                  component="select"
                  value={branch ?? currentBranch?.id ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => navigate(`/deck/${id}/${e.target.value}`)}
                  sx={{
                    fontFamily: SR.fontMono, fontSize: 10, fontWeight: 500,
                    backgroundColor: SR.surfaceCard, color: SR.textMuted,
                    border: `0.5px solid ${SR.border}`, borderRadius: '3px',
                    padding: '2px 6px', cursor: 'pointer', outline: 'none',
                    appearance: 'none',
                  }}
                >
                  {(deck?.allBranches ?? []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Box>
                {headCommitId && <Tag variant="gold">{headCommitId.slice(0, 7)}</Tag>}
                {hasPending && (
                  <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                    {pendingAdds.size + pendingRemoves.size} uncommitted changes
                  </Box>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* List / Images toggle */}
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
                <Button
                  variant="contained" size="small"
                  onClick={() => setCommitOpen(true)}
                  sx={{ fontSize: 11 }}
                >
                  Commit
                </Button>
              )}
            </Box>
          </Box>

          {/* Stat bar */}
          <Box sx={{ display: 'flex', border: `0.5px solid ${SR.border}`, borderRadius: '7px', overflow: 'hidden', mb: '14px' }}>
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
            {/* Search trigger */}
            <Box
              onClick={() => setSearchOpen(o => !o)}
              sx={{
                width: 46, flexShrink: 0, cursor: 'pointer',
                backgroundColor: searchOpen ? SR.surfaceInk : SR.surfacePanel,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '0 7px 7px 0',
                transition: 'background 120ms',
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

        </Box>

        {/* Deck content */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {viewMode === 'text' && (
            <CardListView
              commanderCards={commanderCards}
              mainCards={mainCards}
              addedCards={addedCards}
              pendingAdds={pendingAdds}
              pendingRemoves={pendingRemoves}
              onRemove={stageRemove}
              onUndo={undoChange}
              onSetPortrait={handleSetPortrait}
            />
          )}
          {viewMode === 'images' && (
            <ImagesView
              commanders={commanderCards}
              mainCards={mainCards}
              addedCards={addedCards}
              pendingAdds={pendingAdds}
              pendingRemoves={pendingRemoves}
              onRemove={stageRemove}
              onUndo={undoChange}
              onSetPortrait={handleSetPortrait}
            />
          )}
        </Box>
      </Box>

      {/* ── Right: Search drawer ────────────────────────────────────────────── */}
      <SearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentCards={[...mainCards, ...commanderCards]}
        pendingAdds={pendingAdds}
        pendingRemoves={pendingRemoves}
        onAdd={stageAdd}
        onRemove={stageRemove}
        onUndo={undoChange}
      />

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
          <Button
            variant="contained"
            disabled={!commitDesc.trim() || commitMutation.isPending}
            onClick={handleCommit}
          >
            {commitMutation.isPending ? 'Committing…' : 'Commit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Decklist;
