import '@testing-library/jest-dom';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Decklist from './Decklist';

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
  it('always fetches /api/deck/:id (main branch hardcoded on client)', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [] } });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1')
    );
  });

  it('ignores branch URL param and always calls /api/deck/:id', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-abc', commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: { id: 'deck-1', name: 'Test Deck', branches: [] } });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1')
    );
  });
});
