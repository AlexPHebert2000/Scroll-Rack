import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Decklist from '../components/Decklist';
import type { Card, CardArt } from '../components/CardImage';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
}));

import { useParams } from 'react-router-dom';
const mockUseParams = useParams as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// Hover over a card row to reveal the action buttons.
// userEvent.hover() doesn't trigger onMouseEnter on ancestor elements in JSDOM;
// we fire the event directly on the row container instead.
const hoverCardRow = (cardName: string) =>
  fireEvent.mouseEnter(screen.getByText(cardName).parentElement!);

// Hover to reveal hover buttons, open the "···" menu, then click a menu item by name.
const openCardMenu = async (cardName: string) => {
  hoverCardRow(cardName);
  await userEvent.click(screen.getByRole('button', { name: '···' }));
};

const renderDecklist = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Decklist />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Decklist', () => {
  it('fetches /api/deck/:id when no branch param is present (defaults to main)', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [], allBranches: [], graphBranches: [] } });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1')
    );
  });

  it('fetches /api/deck/:id/:branch when branch URL param is present', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-abc', commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [], allBranches: [], graphBranches: [] } });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1/branch-abc')
    );
  });
});

// ---------------------------------------------------------------------------
// Shared fixture helpers for the tests below
// ---------------------------------------------------------------------------

const card1: Card = { id: 'c1', name: 'Lightning Bolt', oracleId: 'o1', faces: [], defaultArt: { id: 'c1', oracleId: 'o1', name: 'Lightning Bolt', imageUrl: 'https://example.com/bolt.jpg', artCropUrl: null, set: null, setName: null, artist: null, faces: [] } };
const card2: Card = { id: 'c2', name: 'Dark Ritual', oracleId: 'o2', faces: [], defaultArt: { id: 'c2', oracleId: 'o2', name: 'Dark Ritual', imageUrl: 'https://example.com/ritual.jpg', artCropUrl: null, set: null, setName: null, artist: null, faces: [] } };

const altArt: CardArt = { id: 'art-alt', oracleId: 'o1', name: 'Lightning Bolt', imageUrl: 'https://example.com/bolt-alt.jpg', artCropUrl: null, set: 'lea', setName: 'Alpha', artist: 'Christopher Rush', faces: [] };

const deckWith = (cards: Card[], commits: any[] = [], headCommitId: string | null = null) => ({
  data: {
    id: 'deck-1',
    name: 'Test Deck',
    graphBranches: [],
    branches: [{ id: 'branch-1', name: 'main', headCommitId, decklist: { mainDeck: cards, sideBoard: [], commander: [] }, commits }],
    allBranches: [{ id: 'branch-1', name: 'main' }],
  },
});

// Fixture for history/commit-switching tests — includes graphBranches so commit rows render
const headCommit = { id: 'aaabbbccc111222', description: 'Head commit', createdAt: '2024-02-01T00:00:00Z', changes: [] };
const oldCommit  = { id: 'dddeeefff333444', description: 'Old commit',  createdAt: '2024-01-01T00:00:00Z', changes: [] };

const deckWithHistory = (cards: Card[] = [card1]) => ({
  data: {
    id: 'deck-1',
    name: 'Test Deck',
    graphBranches: [{ id: 'branch-1', name: 'main', commits: [oldCommit, headCommit] }],
    branches: [{
      id: 'branch-1', name: 'main',
      headCommitId: headCommit.id,
      decklist: { mainDeck: cards, sideBoard: [], commander: [] },
      commits: [headCommit, oldCommit],
    }],
    allBranches: [{ id: 'branch-1', name: 'main' }],
  },
});

// ---------------------------------------------------------------------------
// Commit flow
// ---------------------------------------------------------------------------

describe('Decklist — commit flow', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('"Commit" button is hidden when there are no pending changes', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^commit$/i })).not.toBeInTheDocument();
  });

  it('"Commit" button appears after staging a removal', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    expect(screen.getByRole('button', { name: /^commit$/i })).toBeInTheDocument();
  });

  it('clicking "Commit" opens the commit dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    expect(screen.getByLabelText(/describe your changes/i)).toBeInTheDocument();
  });

  it('submitting fires POST with correct payload, then clears state and closes dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());

    // Stage a removal then open dialog
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    await userEvent.type(screen.getByLabelText(/describe your changes/i), 'Remove a card');
    // Scope to the dialog to disambiguate from the header Commit button
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^commit$/i }));

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/deck/deck-1/branch-1',
      expect.objectContaining({
        description: 'Remove a card',
        changes: [{ action: 'REMOVE', board: 'MAIN', cardId: 'c1', count: 1 }],
        mainDeck: [],
        sideBoard: [],
      })
    );

    // Dialog closes and commit button disappears (pending state cleared)
    await waitFor(() =>
      expect(screen.queryByLabelText(/describe your changes/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /^commit$/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// View mode toggle
// ---------------------------------------------------------------------------

describe('Decklist — view mode toggle', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('starts in list mode showing card names as text', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    expect(screen.queryByRole('img', { name: 'Lightning Bolt' })).not.toBeInTheDocument();
  });

  it('switches to images mode when the Images toggle is clicked', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^images$/i }));
    expect(screen.getByRole('img', { name: 'Lightning Bolt' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pending state management
// ---------------------------------------------------------------------------

describe('Decklist — pending state management', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('pending removal is tracked when a card is staged for removal', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1, card2]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    expect(screen.getByText('1 uncommitted change')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Commit graph sidebar
// ---------------------------------------------------------------------------

describe('Decklist — commit graph sidebar', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('shows commit description in the diff history panel', async () => {
    const commit = { id: 'abc1234567', description: 'First commit', createdAt: '2024-01-01T00:00:00Z', changes: [] };
    mockedAxios.get.mockResolvedValue(deckWith([], [commit]));
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('First commit').length).toBeGreaterThan(0));
  });
});

// ---------------------------------------------------------------------------
// Commit history navigation
// ---------------------------------------------------------------------------

describe('Decklist — commit history navigation', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('clicking a non-HEAD commit row enters history mode and shows the history banner', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory());
    renderDecklist();
    // Old commit appears in both the graph and the diff panel — [0] = graph row
    await waitFor(() => expect(screen.getAllByText('Old commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Old commit')[0]);
    expect(screen.getByRole('button', { name: /return to head/i })).toBeInTheDocument();
  });

  it('history mode shows the selected commit short hash in the banner', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory());
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('Old commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Old commit')[0]);
    // Short hash appears in the history banner (may also appear elsewhere in the graph)
    await waitFor(() =>
      expect(screen.getAllByText(oldCommit.id.slice(0, 7)).length).toBeGreaterThan(0)
    );
  });

  it('"Return to HEAD" button dismisses the history banner', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory());
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('Old commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Old commit')[0]);
    expect(screen.getByRole('button', { name: /return to head/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to head/i }));
    expect(screen.queryByRole('button', { name: /return to head/i })).not.toBeInTheDocument();
  });

  it('history mode fires GET for the historical snapshot at the correct URL', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory());
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('Old commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Old commit')[0]);
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/deck/deck-1/branch-1/${oldCommit.id}`
      )
    );
  });

  it('clicking the HEAD commit does not enter history mode', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory());
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('Head commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Head commit')[0]);
    expect(screen.queryByRole('button', { name: /return to head/i })).not.toBeInTheDocument();
  });

  it('in history mode, the "Commit" button is not shown', async () => {
    mockedAxios.get.mockResolvedValue(deckWithHistory([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getAllByText('Old commit').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('Old commit')[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: /return to head/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^commit$/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Art selection
// ---------------------------------------------------------------------------

describe('Decklist — art selection', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('"Select printing" menu item is present in the card menu for cards with an oracleId', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    expect(screen.getByRole('menuitem', { name: /select printing/i })).toBeInTheDocument();
  });

  it('clicking "Select printing" from the card menu opens the art picker dialog', async () => {
    // arts endpoint returns empty so picker shows "No alternate art found"
    mockedAxios.get.mockImplementation((url: string) =>
      url.includes('/api/scryfall/arts')
        ? Promise.resolve({ data: [] })
        : Promise.resolve(deckWith([card1]))
    );
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /select printing/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('pending art change increments the uncommitted changes count', async () => {
    mockedAxios.get.mockImplementation((url: string) =>
      url.includes('/api/scryfall/arts')
        ? Promise.resolve({ data: [altArt] })
        : Promise.resolve(deckWith([card1]))
    );
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    // Open art picker via card menu
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /select printing/i }));
    // Wait for art grid to load and select an art tile
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Alpha'));
    // A pending art change should be reflected in the pending count
    await waitFor(() => expect(screen.getByText('1 uncommitted change')).toBeInTheDocument());
  });

  it('art change is synced as SET_ART in the working-tree PUT when Quick Commit is clicked', async () => {
    mockedAxios.get.mockImplementation((url: string) =>
      url.includes('/api/scryfall/arts')
        ? Promise.resolve({ data: [altArt] })
        : Promise.resolve(deckWith([card1]))
    );
    // Quick Commit flushes the working tree via PUT then POSTs quick-commit.
    // Use mockResolvedValue (not Once) since the debounced sync may also fire PUT.
    mockedAxios.put.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());

    // Stage an art change via the card menu
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /select printing/i }));
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Alpha'));
    await waitFor(() => expect(screen.getByText('1 uncommitted change')).toBeInTheDocument());
    // Wait for the art picker dialog to fully close (MUI exit animation ~195ms)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /select art/i })).not.toBeInTheDocument()
    );

    // Click "Quick Commit" — this immediately syncs the working tree with the SET_ART change
    await userEvent.click(screen.getByRole('button', { name: /quick commit/i }));

    expect(mockedAxios.put).toHaveBeenCalledWith(
      '/api/deck/deck-1/branch-1/working-tree',
      expect.objectContaining({
        changes: expect.arrayContaining([
          { action: 'SET_ART', cardId: 'c1', artId: 'art-alt' },
        ]),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Discard changes
// ---------------------------------------------------------------------------

describe('Decklist — discard changes', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('"Discard" button is hidden when there are no pending changes', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^discard$/i })).not.toBeInTheDocument();
  });

  it('"Discard" button appears after staging a change', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument();
  });

  it('clicking "Discard" shows inline confirm buttons', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(screen.getByRole('button', { name: /confirm discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^discard$/i })).not.toBeInTheDocument();
  });

  it('clicking "Cancel" in the confirm state restores the Discard button', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm discard/i })).not.toBeInTheDocument();
  });

  it('"Confirm discard" fires PUT /working-tree with empty changes', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    mockedAxios.put.mockResolvedValue({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm discard/i }));
    expect(mockedAxios.put).toHaveBeenCalledWith(
      '/api/deck/deck-1/branch-1/working-tree',
      { changes: [] }
    );
  });

  it('after a successful discard the pending count and Discard button disappear', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    mockedAxios.put.mockResolvedValue({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await openCardMenu('Lightning Bolt');
    await userEvent.click(screen.getByRole('menuitem', { name: /remove 1/i }));
    await waitFor(() => expect(screen.getByText('1 uncommitted change')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm discard/i }));
    await waitFor(() => expect(screen.queryByText(/uncommitted change/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^discard$/i })).not.toBeInTheDocument();
  });
});
