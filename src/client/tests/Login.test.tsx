import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Login from '../components/Login';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Login', () => {
  it('renders username/email and password inputs', () => {
    renderLogin();
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('password field is masked', () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
  });

  it('navigates to / after successful login with email', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 200 });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });

  it('navigates to / after successful login with username', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 200 });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'tarmogoyf42' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith('/api/user/login', {
      identifier: 'tarmogoyf42',
      password: 'password',
    }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });

  it('has a link to the signup page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
  });

  it('does not navigate when login fails', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { data: { error: 'Unauthorized' } } });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
