import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [], allBranches: [] } });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1')
    );
  });

  it('fetches /api/deck/:id/:branch when branch URL param is present', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-abc', commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [], allBranches: [] } });

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
    branches: [{ id: 'branch-1', name: 'main', decklist: { mainDeck: cards, sideBoard: [] }, commits }],
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

  it('"Commit Changes" button is hidden when there are no pending changes', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Test Deck')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /commit changes/i })).not.toBeInTheDocument();
  });

  it('"Commit Changes" button appears after staging a removal', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Test Deck')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getByRole('button', { name: /commit changes/i })).toBeInTheDocument();
  });

  it('clicking "Commit Changes" opens the commit dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Test Deck')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /commit changes/i }));
    expect(screen.getByLabelText(/describe your changes/i)).toBeInTheDocument();
  });

  it('submitting fires POST with correct payload, then clears state and closes dialog', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1]));
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Test Deck')).toBeInTheDocument());

    // Stage a removal then open dialog
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /commit changes/i }));
    await userEvent.type(screen.getByLabelText(/describe your changes/i), 'Remove a card');
    await userEvent.click(screen.getByRole('button', { name: /^commit$/i }));

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/deck/deck-1/branch-1', {
      description: 'Remove a card',
      changes: [{ action: 'REMOVE', board: 'MAIN', cardId: 'c1' }],
      mainDeck: [],
      sideBoard: [],
    });

    // Dialog closes and commit button disappears (pending state cleared)
    await waitFor(() =>
      expect(screen.queryByLabelText(/describe your changes/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /commit changes/i })).not.toBeInTheDocument();
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

  it('card count label decreases when a card is staged for removal', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([card1, card2]));
    renderDecklist();
    await waitFor(() =>
      expect(screen.getByText('2 cards')).toBeInTheDocument()
    );
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(screen.getByText('1 cards')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// History drawer
// ---------------------------------------------------------------------------

describe('Decklist — history drawer', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
  });

  it('opens the history drawer when the History button is clicked', async () => {
    mockedAxios.get.mockResolvedValue(deckWith([]));
    renderDecklist();
    await waitFor(() => expect(screen.getByText('Test Deck')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText('Commit History')).toBeInTheDocument();
  });
});
