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
  it('fetches /api/deck/:id/:branch when branch is present', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-abc', commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: {} });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1/branch-abc')
    );
  });

  it('fetches /api/deck/:id when no branch is in the URL', async () => {
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: undefined, commit: undefined });
    mockedAxios.get.mockResolvedValueOnce({ data: {} });

    renderDecklist();

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1')
    );
  });

  it('re-fetches when branch param changes', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    // First render with branch-1
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-1', commit: undefined });
    const { unmount } = renderDecklist();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1/branch-1')
    );
    unmount();

    // Second independent render with branch-2
    mockUseParams.mockReturnValue({ id: 'deck-1', branch: 'branch-2', commit: undefined });
    renderDecklist();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/deck/deck-1/branch-2')
    );
  });
});
