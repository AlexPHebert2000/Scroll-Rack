import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import NavBar from '../components/NavBar';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

const renderNavBar = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('NavBar', () => {
  it('has a link to the home page', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderNavBar();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /scroll rack/i })).toHaveAttribute('href', '/')
    );
  });

  describe('unauthenticated', () => {
    it('shows a login link', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
      renderNavBar();
      await waitFor(() =>
        expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
      );
    });

    it('does not show the profile icon', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
      renderNavBar();
      await waitFor(() => expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
    });
  });

  describe('authenticated', () => {
    const sessionResponse = { data: { user: { username: 'testuser', decks: [] } } };

    it('shows the profile icon button', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      renderNavBar();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument()
      );
    });

    it('does not show a login link', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      renderNavBar();
      await waitFor(() => expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument());
      expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
    });

    it('opens a menu when the profile icon is clicked', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      renderNavBar();
      await waitFor(() => screen.getByRole('button', { name: /profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /profile/i }));
      expect(screen.getByRole('menuitem', { name: /my account/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
    });

    it('menu has a link to the user profile page', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      renderNavBar();
      await waitFor(() => screen.getByRole('button', { name: /profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /profile/i }));
      expect(screen.getByRole('menuitem', { name: /my account/i })).toHaveAttribute(
        'href',
        '/profile/testuser'
      );
    });

    it('logout calls the logout endpoint and redirects to /login', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      renderNavBar();
      await waitFor(() => screen.getByRole('button', { name: /profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /profile/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }));
      await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith('/api/user/logout'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('menu is not visible before the profile icon is clicked', async () => {
      mockedAxios.get.mockResolvedValueOnce(sessionResponse);
      renderNavBar();
      await waitFor(() => screen.getByRole('button', { name: /profile/i }));
      expect(screen.queryByRole('menuitem', { name: /my account/i })).not.toBeInTheDocument();
    });

    describe('new deck button', () => {
      it('shows the new deck button when logged in', async () => {
        mockedAxios.get.mockResolvedValueOnce(sessionResponse);
        renderNavBar();
        await waitFor(() =>
          expect(screen.getByRole('button', { name: /new deck/i })).toBeInTheDocument()
        );
      });

      it('does not show the new deck button when logged out', async () => {
        mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });
        renderNavBar();
        await waitFor(() => expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /new deck/i })).not.toBeInTheDocument();
      });

      it('opens the new deck dialog when clicked', async () => {
        mockedAxios.get.mockResolvedValueOnce(sessionResponse);
        renderNavBar();
        await waitFor(() => screen.getByRole('button', { name: /new deck/i }));
        fireEvent.click(screen.getByRole('button', { name: /new deck/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/deck name/i)).toBeInTheDocument();
      });

      it('create button is disabled when deck name is empty', async () => {
        mockedAxios.get.mockResolvedValueOnce(sessionResponse);
        renderNavBar();
        await waitFor(() => screen.getByRole('button', { name: /new deck/i }));
        fireEvent.click(screen.getByRole('button', { name: /new deck/i }));
        expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
      });

      it('creates deck and navigates to it on submit', async () => {
        mockedAxios.get.mockResolvedValueOnce(sessionResponse);
        mockedAxios.post.mockResolvedValueOnce({ data: { deckId: 'deck-123' } });
        renderNavBar();
        await waitFor(() => screen.getByRole('button', { name: /new deck/i }));
        fireEvent.click(screen.getByRole('button', { name: /new deck/i }));
        fireEvent.change(screen.getByLabelText(/deck name/i), { target: { value: 'My New Deck' } });
        fireEvent.click(screen.getByRole('button', { name: /create/i }));
        await waitFor(() =>
          expect(mockedAxios.post).toHaveBeenCalledWith('/api/deck', { name: 'My New Deck' })
        );
        expect(mockNavigate).toHaveBeenCalledWith('/deck/deck-123');
      });

      it('closes the dialog when cancel is clicked', async () => {
        mockedAxios.get.mockResolvedValueOnce(sessionResponse);
        renderNavBar();
        await waitFor(() => screen.getByRole('button', { name: /new deck/i }));
        fireEvent.click(screen.getByRole('button', { name: /new deck/i }));
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      });
    });
  });
});
