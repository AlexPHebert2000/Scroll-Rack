import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import UserProvider, { useUser } from './UserContext';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── Test consumer ─────────────────────────────────────────────────────────────

const TestConsumer = () => {
  const { user, isLoading, isSuccess } = useUser();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="success">{String(isSuccess)}</span>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <span data-testid="decks">{user?.decks.length ?? 0}</span>
    </div>
  );
};

const renderWithProvider = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      </QueryClientProvider>
    ),
  };
};

const userFixture = {
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  decks: [{ id: 'd1', name: 'My Deck' }],
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserContext', () => {
  it('starts with isLoading:true and null user before the query resolves', () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProvider();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('success')).toHaveTextContent('false');
    expect(screen.getByTestId('username')).toHaveTextContent('none');
  });

  it('provides the user when the session query succeeds', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { user: userFixture } });
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('success')).toHaveTextContent('true'));
    expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('decks')).toHaveTextContent('1');
  });

  it('provides null user and isSuccess:false when the session query fails (401)', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('username')).toHaveTextContent('none');
    expect(screen.getByTestId('success')).toHaveTextContent('false');
  });

  it('fetches GET /api/user/me exactly once', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { user: userFixture } });
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('success')).toHaveTextContent('true'));
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/user/me');
  });

  it('clears the user when queryData is set to null (simulates logout)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { user: userFixture } });
    const { queryClient } = renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('username')).toHaveTextContent('testuser'));

    act(() => { queryClient.setQueryData(['sessionLookup'], null); });

    await waitFor(() => expect(screen.getByTestId('username')).toHaveTextContent('none'));
  });
});
