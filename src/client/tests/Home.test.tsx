import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Home from '../components/Home';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

const renderHome = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Home', () => {
  it('renders deck names when session is valid', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        user: {
          username: 'testuser',
          decks: [
            { name: 'My First Deck', id: 'deck-1' },
            { name: 'Control Deck', id: 'deck-2' },
          ],
        },
      },
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('My First Deck')).toBeInTheDocument();
      expect(screen.getByText('Control Deck')).toBeInTheDocument();
    });
  });

  it('renders "No decks" when the user has an empty deck list', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { user: { username: 'testuser', decks: [] } },
    });

    renderHome();

    await waitFor(() => expect(screen.getByText(/log in/)).toBeInTheDocument());
  });

  it('shows a login prompt when the session query fails', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });

    renderHome();

    await waitFor(() => expect(screen.getByText(/log in/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls /api/user/me to check the session', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { user: { username: 'testuser', decks: [] } },
    });

    renderHome();

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledWith('/api/user/me'));
  });
});
