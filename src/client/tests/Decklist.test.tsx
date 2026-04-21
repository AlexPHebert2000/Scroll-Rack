import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Decklist from '../components/Decklist';
import type { Card } from '../components/CardImage';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
}));

import { useParams } from 'react-router-dom';
const mockUseParams = useParams as jest.Mock;

beforeEach(() => jest.clearAllMocks());

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

const card1: Card = { id: 'c1', name: 'Lightning Bolt', imageUrl: 'https://example.com/bolt.jpg', faces: [] };
const card2: Card = { id: 'c2', name: 'Dark Ritual', imageUrl: 'https://example.com/ritual.jpg', faces: [] };

const deckWith = (cards: Card[], commits = []) => ({
  data: {
    id: 'deck-1',
    name: 'Test Deck',
    graphBranches: [],
    branches: [{ id: 'branch-1', name: 'main', headCommitId: null, decklist: { mainDeck: cards, sideBoard: [], commander: [] }, commits }],
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
    await userEvent.hover(screen.getByText('Lightning Bolt'));
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getByRole('button', { name: /^commit$/i })).toBeInTheDocument();
  });

  it('clicking "Commit" opens the commit dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());
    await userEvent.hover(screen.getByText('Lightning Bolt'));
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    expect(screen.getByLabelText(/describe your changes/i)).toBeInTheDocument();
  });

  it('submitting fires POST with correct payload, then clears state and closes dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Lightning Bolt')).toBeInTheDocument());

    // Stage a removal then open dialog
    await userEvent.hover(screen.getByText('Lightning Bolt'));
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    await userEvent.type(screen.getByLabelText(/describe your changes/i), 'Remove a card');
    // Scope to the dialog to disambiguate from the header Commit button
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^commit$/i }));

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/deck/deck-1/branch-1',
      expect.objectContaining({
        description: 'Remove a card',
        changes: [{ action: 'REMOVE', board: 'MAIN', cardId: 'c1' }],
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
    await userEvent.hover(screen.getByText('Lightning Bolt'));
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getByText('1 uncommitted changes')).toBeInTheDocument();
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
