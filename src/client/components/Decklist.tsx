import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Card } from './CardImage';
import CommitHistory from './CommitHistory';
import type { Commit } from './CommitHistory';
import DecklistCards from './DecklistCards';
import SearchResults from './SearchResults';
import { SR } from '../theme';

interface DecklistState { mainDeck: Card[]; sideBoard: Card[]; }
interface Branch { id: string; name: string; decklist: DecklistState; commits: Commit[]; }
interface Deck { id: string; name: string; branches: Branch[]; allBranches: { id: string; name: string }[]; }

const SidebarDot = ({ active }: { active?: boolean }) => (
  <Box sx={{
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    backgroundColor: active ? SR.accentTealLight : SR.border,
  }} />
);

const SidebarLabel = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{
    fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.10em',
    color: SR.textFaint, padding: '0 10px 4px 10px', mt: '10px',
  }}>
    {children}
  </Box>
);

const SidebarItem = ({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      padding: '7px 10px', mx: '6px',
      fontSize: 13, fontFamily: SR.fontUi,
      color: active ? SR.textLight : SR.textPrimary,
      backgroundColor: active ? SR.surfaceInk : 'transparent',
      borderRadius: '6px', cursor: 'pointer',
      transition: 'background 100ms',
      '&:hover': { backgroundColor: active ? SR.surfaceInk : SR.surfaceCard },
    }}
  >
    <SidebarDot active={active} />
    {label}
  </Box>
);

const Decklist = () => {
  const { id, branch } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deckQ = useQuery<{ data: Deck }>({
    queryKey: ['deckFetch', id, branch],
    queryFn: () => axios.get(`/api/deck/${id}${branch ? `/${branch}` : ''}`),
  });

  const deck: Deck | undefined = deckQ.data?.data;
  const currentBranch: Branch | undefined = deck?.branches?.[0];
  const currentCards: Card[] = currentBranch?.decklist?.mainDeck ?? [];
  const branchId = currentBranch?.id;
  const commits: Commit[] = currentBranch?.commits ?? [];

  const [viewMode, setViewMode] = useState<'list' | 'images'>('list');
  const [activeTab, setActiveTab] = useState<'list' | 'diff' | 'history'>('list');

  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const hasPendingChanges = pendingAdds.size > 0 || pendingRemoves.size > 0;

  const stageAdd = (card: Card) => {
    setPendingRemoves((prev) => { const s = new Set(prev); s.delete(card.id); return s; });
    setPendingAdds((prev) => new Set(prev).add(card.id));
    queryClient.setQueryData(['card', card.id], card);
  };

  const stageRemove = (cardId: string) => {
    setPendingAdds((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
    setPendingRemoves((prev) => new Set(prev).add(cardId));
  };

  const undoChange = (cardId: string) => {
    setPendingAdds((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
    setPendingRemoves((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
  };

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const searchQ = useQuery<{ data: Card[] }>({
    queryKey: ['cardSearch', activeSearch],
    queryFn: () => axios.get(`/api/scryfall/search?qString=${encodeURIComponent(activeSearch)}`),
    enabled: activeSearch.length > 0,
  });

  const handleSearch = () => { if (searchInput.trim()) setActiveSearch(searchInput.trim()); };

  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDesc, setCommitDesc] = useState('');

  const commitMutation = useMutation({
    mutationFn: (payload: {
      description: string;
      changes: { action: string; board: string; cardId: string }[];
      mainDeck: string[];
      sideBoard: string[];
    }) => axios.post(`/api/deck/${id}/${branchId}`, payload),
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
      ...[...pendingAdds].map((cardId) => ({ action: 'ADD', board: 'MAIN', cardId })),
      ...[...pendingRemoves].map((cardId) => ({ action: 'REMOVE', board: 'MAIN', cardId })),
    ];
    const newDeckIds = new Set(currentCards.map((c) => c.id));
    pendingAdds.forEach((cid) => newDeckIds.add(cid));
    pendingRemoves.forEach((cid) => newDeckIds.delete(cid));
    commitMutation.mutate({ description: commitDesc, changes, mainDeck: [...newDeckIds], sideBoard: [] });
  };

  const addedCards: Card[] = [...pendingAdds]
    .filter((cid) => !currentCards.some((c) => c.id === cid))
    .map((cid) => queryClient.getQueryData<Card>(['card', cid])!)
    .filter(Boolean);

  const [historyOpen, setHistoryOpen] = useState(false);

  const branchMutation = useMutation({
    mutationFn: ({ sourceCommitId, branchName }: { sourceCommitId: string; branchName: string }) =>
      axios.post(`/api/deck/${id}/branch`, { sourceCommitId, branchName }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['deckFetch', id] });
      navigate(`/deck/${id}/${data.branchId}`);
    },
  });

  const totalCards = currentCards.length + pendingAdds.size - pendingRemoves.size;

  if (deckQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Typography sx={{ fontFamily: SR.fontMono, fontSize: 12, color: SR.textFaint }}>loading…</Typography>
      </Box>
    );
  }
  if (deckQ.isError) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.accentRed }}>Failed to load deck.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <Box sx={{
        width: 205, flexShrink: 0,
        backgroundColor: SR.surfacePanel,
        borderRight: `0.5px solid ${SR.border}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', pt: '12px', pb: '12px',
      }}>
        <SidebarLabel>Branches</SidebarLabel>
        {(deck?.allBranches ?? []).map((b) => (
          <SidebarItem
            key={b.id}
            label={b.name}
            active={b.id === (branch ?? currentBranch?.id)}
            onClick={() => navigate(`/deck/${id}/${b.id}`)}
          />
        ))}

        <Box sx={{ height: '0.5px', backgroundColor: SR.border, mx: '10px', my: '6px' }} />

        <SidebarLabel>Actions</SidebarLabel>
        <Box sx={{ mx: '6px', px: '10px' }}>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            onClick={() => setHistoryOpen(true)}
            sx={{ justifyContent: 'flex-start', fontSize: 12, color: SR.textMuted, borderColor: SR.border, mb: 1 }}
          >
            View history
          </Button>
        </Box>
      </Box>

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: SR.surfaceApp }}>

        {/* Deck header */}
        <Box sx={{ px: '20px', pt: '16px', pb: 0, borderBottom: `0.5px solid ${SR.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: '12px' }}>
            <Box>
              <Typography sx={{ fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 22, letterSpacing: '0.03em', color: SR.textPrimary, lineHeight: 1.2, mb: '6px' }}>
                {deck?.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Branch selector as tag */}
                <Select
                  value={branch ?? currentBranch?.id ?? ''}
                  onChange={(e) => navigate(`/deck/${id}/${e.target.value}`)}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: SR.fontMono, fontSize: 11, height: 22,
                    color: SR.textMuted, backgroundColor: SR.surfaceCard,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: SR.border, borderWidth: '0.5px' },
                    '& .MuiSelect-select': { py: '1px', px: '8px' },
                  }}
                >
                  {(deck?.allBranches ?? []).map((b) => (
                    <MenuItem key={b.id} value={b.id} sx={{ fontFamily: SR.fontMono, fontSize: 11 }}>{b.name}</MenuItem>
                  ))}
                </Select>

                <Typography sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                  {totalCards} cards
                </Typography>
                {hasPendingChanges && (
                  <Typography sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint }}>
                    · {pendingAdds.size + pendingRemoves.size} uncommitted
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={(_, v) => { if (v) setViewMode(v); }}
              >
                <ToggleButton value="list">List</ToggleButton>
                <ToggleButton value="images">Images</ToggleButton>
              </ToggleButtonGroup>
              {hasPendingChanges && (
                <Button variant="contained" size="small" onClick={() => setCommitOpen(true)}>
                  Commit changes
                </Button>
              )}
            </Box>
          </Box>

          {/* Stat bar */}
          <Box sx={{ display: 'flex', border: `0.5px solid ${SR.border}`, borderRadius: '6px', overflow: 'hidden', mb: '14px' }}>
            {[
              { label: 'Cards', value: String(totalCards) },
              { label: 'Commits', value: String(commits.length), color: SR.accentTeal },
              { label: 'Branches', value: String(deck?.allBranches?.length ?? 1), color: SR.accentTeal },
            ].map((s, i, arr) => (
              <Box key={s.label} sx={{
                flex: 1, backgroundColor: SR.surfacePanel, padding: '10px 14px',
                borderRight: i < arr.length - 1 ? `0.5px solid ${SR.border}` : 'none',
              }}>
                <Box sx={{ fontFamily: SR.fontMono, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: SR.textFaint, mb: '4px' }}>
                  {s.label}
                </Box>
                <Box sx={{ fontFamily: SR.fontDisplay, fontSize: 18, fontWeight: 600, color: s.color ?? SR.textPrimary }}>
                  {s.value}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Tabs */}
          <Box sx={{ display: 'flex' }}>
            {(['list', 'diff', 'history'] as const).map((t) => (
              <Box
                key={t}
                onClick={() => setActiveTab(t)}
                sx={{
                  padding: '8px 16px', fontSize: 12, fontFamily: SR.fontUi,
                  fontWeight: activeTab === t ? 500 : 400,
                  color: activeTab === t ? SR.textPrimary : SR.textFaint,
                  borderBottom: activeTab === t ? `1.5px solid ${SR.textPrimary}` : '1.5px solid transparent',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {t}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'list' && (
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
              {/* Left: card list */}
              <Box sx={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', borderRight: `0.5px solid ${SR.border}`, overflow: 'hidden', p: '12px 0' }}>
                <Box sx={{ px: '14px', pb: '6px' }}>
                  <Typography sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: SR.textFaint }}>
                    Main deck — {totalCards} cards
                  </Typography>
                </Box>
                <DecklistCards
                  currentCards={currentCards}
                  addedCards={addedCards}
                  pendingRemoves={pendingRemoves}
                  viewMode={viewMode}
                  onRemove={stageRemove}
                  onUndo={undoChange}
                />
              </Box>

              {/* Right: search */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: '12px 16px', gap: '10px', overflow: 'hidden' }}>
                <Typography sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: SR.textFaint }}>
                  Search Cards
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Card name or query"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button variant="outlined" onClick={handleSearch} disabled={searchQ.isFetching} sx={{ flexShrink: 0 }}>
                    Search
                  </Button>
                </Box>
                {searchQ.isError && (
                  <Typography sx={{ fontSize: 12, color: SR.accentRed }}>Search failed.</Typography>
                )}
                <SearchResults
                  results={searchQ.data?.data ?? []}
                  currentCards={currentCards}
                  pendingAdds={pendingAdds}
                  pendingRemoves={pendingRemoves}
                  viewMode={viewMode}
                  activeSearch={activeSearch}
                  isFetching={searchQ.isFetching}
                  onAdd={stageAdd}
                  onRemove={stageRemove}
                  onUndo={undoChange}
                />
              </Box>
            </Box>
          )}

          {activeTab === 'diff' && (
            <Box sx={{ p: '16px', overflow: 'auto', flex: 1 }}>
              {commits.length === 0 ? (
                <Typography sx={{ fontFamily: SR.fontMono, fontSize: 12, color: SR.textFaint }}>No commits yet.</Typography>
              ) : (
                <Box sx={{
                  backgroundColor: SR.surfaceInk, borderRadius: '8px',
                  padding: '13px 15px', fontFamily: SR.fontMono, fontSize: 12, lineHeight: 1.8,
                }}>
                  <Box sx={{ color: SR.diffHash }}>commit {commits[0].id.slice(0, 7)} · {currentBranch?.name}</Box>
                  <Box sx={{ color: SR.diffMeta }}>// {commits[0].changes.length} changes · {commits[0].changes.filter((c) => c.action === 'ADD').length} added · {commits[0].changes.filter((c) => c.action === 'REMOVE').length} removed</Box>
                  <Box sx={{ mt: 1 }}>
                    {commits[0].changes.map((ch, i) => (
                      <Box key={i} sx={{ color: ch.action === 'ADD' ? SR.diffAdd : SR.diffRemove }}>
                        {ch.action === 'ADD' ? '+ ' : '- '}{ch.card.name}
                      </Box>
                    ))}
                    {commits[0].changes.length === 0 && (
                      <Box sx={{ color: SR.diffMeta }}>// no card changes in this commit</Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 'history' && (
            <Box sx={{ p: '16px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {commits.map((commit, i) => (
                <Box
                  key={commit.id}
                  sx={{
                    backgroundColor: SR.surfacePanel,
                    border: `0.5px solid ${SR.border}`,
                    borderRadius: '7px', padding: '10px 14px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: '4px' }}>
                    <Box sx={{
                      fontFamily: SR.fontMono, fontSize: 10, color: SR.accentGold,
                      backgroundColor: SR.accentGoldLight, border: `0.5px solid ${SR.accentGoldBorder}`,
                      borderRadius: '3px', padding: '1px 6px',
                    }}>
                      {commit.id.slice(0, 7)}
                    </Box>
                    {i === 0 && (
                      <Box sx={{
                        fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, color: SR.accentTeal,
                        backgroundColor: SR.accentTealBg, border: `0.5px solid ${SR.accentTealLight}`,
                        borderRadius: '3px', padding: '1px 6px',
                      }}>
                        HEAD
                      </Box>
                    )}
                    <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint, ml: 'auto' }}>
                      {new Date(commit.createdAt).toLocaleDateString()}
                    </Box>
                  </Box>
                  <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textPrimary }}>{commit.description}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Commit dialog ── */}
      <Dialog open={commitOpen} onClose={() => setCommitOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Commit Changes</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Describe your changes"
            value={commitDesc}
            onChange={(e) => setCommitDesc(e.target.value)}
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

      {/* ── History drawer ── */}
      <CommitHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        branchName={currentBranch?.name ?? 'main'}
        commits={commits}
        onBranchFrom={({ commitId, branchName }) => branchMutation.mutate({ sourceCommitId: commitId, branchName })}
        isBranching={branchMutation.isPending}
      />
    </Box>
  );
};

export default Decklist;
