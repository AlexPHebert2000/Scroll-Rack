import React, { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { Card } from "./CardImage";
import DecklistCards from "./DecklistCards";
import SearchResults from "./SearchResults";

interface Branch { id: string; name: string; cards: Card[]; }
interface Deck { id: string; name: string; branches: Branch[]; }

const Decklist = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  // ── Deck fetch ──────────────────────────────────────────────────────────────
  const deckQ = useQuery<{ data: Deck }>({
    queryKey: ["deckFetch", id],
    queryFn: () => axios.get(`/api/deck/${id}`),
  });

  const deck: Deck | undefined = deckQ.data?.data;
  const currentBranch: Branch | undefined = deck?.branches?.[0];
  const currentCards: Card[] = currentBranch?.cards ?? [];
  const branchId = currentBranch?.id;

  // ── View mode ───────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"list" | "images">("list");

  // ── Pending changes ─────────────────────────────────────────────────────────
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());

  const hasPendingChanges = pendingAdds.size > 0 || pendingRemoves.size > 0;

  const stageAdd = (card: Card) => {
    setPendingRemoves((prev) => { const s = new Set(prev); s.delete(card.id); return s; });
    setPendingAdds((prev) => new Set(prev).add(card.id));
    queryClient.setQueryData(["card", card.id], card);
  };

  const stageRemove = (cardId: string) => {
    setPendingAdds((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
    setPendingRemoves((prev) => new Set(prev).add(cardId));
  };

  const undoChange = (cardId: string) => {
    setPendingAdds((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
    setPendingRemoves((prev) => { const s = new Set(prev); s.delete(cardId); return s; });
  };

  // ── Card search ─────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const searchQ = useQuery<{ data: Card[] }>({
    queryKey: ["cardSearch", activeSearch],
    queryFn: () =>
      axios.get(`/api/scryfall/search?qString=${encodeURIComponent(activeSearch)}`),
    enabled: activeSearch.length > 0,
  });

  const handleSearch = () => {
    if (searchInput.trim()) setActiveSearch(searchInput.trim());
  };

  // ── Commit ──────────────────────────────────────────────────────────────────
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitDesc, setCommitDesc] = useState("");

  const commitMutation = useMutation({
    mutationFn: (payload: {
      description: string;
      changes: { action: string; cardId: string }[];
      decklist: string[];
    }) => axios.post(`/api/deck/${id}/${branchId}`, payload),
    onSuccess: () => {
      setPendingAdds(new Set());
      setPendingRemoves(new Set());
      setCommitOpen(false);
      setCommitDesc("");
      queryClient.invalidateQueries({ queryKey: ["deckFetch", id] });
    },
  });

  const handleCommit = () => {
    const changes = [
      ...[...pendingAdds].map((cardId) => ({ action: "add", cardId })),
      ...[...pendingRemoves].map((cardId) => ({ action: "remove", cardId })),
    ];

    const newDeckIds = new Set(currentCards.map((c) => c.id));
    pendingAdds.forEach((cid) => newDeckIds.add(cid));
    pendingRemoves.forEach((cid) => newDeckIds.delete(cid));

    commitMutation.mutate({ description: commitDesc, changes, decklist: [...newDeckIds] });
  };

  // Pending adds that aren't already in the current deck
  const addedCards: Card[] = [...pendingAdds]
    .filter((cid) => !currentCards.some((c) => c.id === cid))
    .map((cid) => queryClient.getQueryData<Card>(["card", cid])!)
    .filter(Boolean);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (deckQ.isLoading) return <Typography>Loading…</Typography>;
  if (deckQ.isError) return <Typography color="error">Failed to load deck.</Typography>;

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", gap: 2, p: 2 }}>

      {/* ── Left: Decklist ── */}
      <Box sx={{ flex: "0 0 66.67%", display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>

        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h5">{deck?.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Branch: {currentBranch?.name ?? "main"} · {currentCards.length + pendingAdds.size - pendingRemoves.size} cards
            </Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_, v) => { if (v) setViewMode(v); }}
          >
            <ToggleButton value="list">List</ToggleButton>
            <ToggleButton value="images">Images</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <DecklistCards
          currentCards={currentCards}
          addedCards={addedCards}
          pendingRemoves={pendingRemoves}
          viewMode={viewMode}
          onRemove={stageRemove}
          onUndo={undoChange}
        />

        {hasPendingChanges && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {pendingAdds.size} addition{pendingAdds.size !== 1 ? "s" : ""},&nbsp;
              {pendingRemoves.size} removal{pendingRemoves.size !== 1 ? "s" : ""} pending
            </Typography>
            <Button variant="contained" onClick={() => setCommitOpen(true)}>
              Commit Changes
            </Button>
          </Box>
        )}
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* ── Right: Card search ── */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
        <Typography variant="h6">Search Cards</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Card name or query"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button variant="outlined" onClick={handleSearch} disabled={searchQ.isFetching}>
            Search
          </Button>
        </Box>

        {searchQ.isError && (
          <Typography color="error" variant="body2">Search failed.</Typography>
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
          <Button onClick={() => setCommitOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!commitDesc.trim() || commitMutation.isPending}
            onClick={handleCommit}
          >
            {commitMutation.isPending ? "Committing…" : "Commit"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Decklist;
