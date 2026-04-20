import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Signup from '../components/Signup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => jest.clearAllMocks());

const renderSignup = () =>
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );

describe('Signup', () => {
  it('renders all input fields', () => {
    renderSignup();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('password field is masked', () => {
    renderSignup();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
  });

  it('navigates to /login after successful signup', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 201 });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('posts to /api/user with all fields', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 201 });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/user', {
        name: 'testuser',
        username: 'testuser',
        email: 'test@test.com',
        password: 'password123',
      })
    );
  });

  it('shows server error message on failure', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'Email test@test.com already in use' } },
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(screen.getByText('Email test@test.com already in use')).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows fallback error message when server provides none', async () => {
    mockedAxios.post.mockRejectedValueOnce({});

    renderSignup();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(screen.getByText('Sign up failed')).toBeInTheDocument()
    );
  });

  it('shows inline validation error when username is empty', async () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(screen.getByText('username is required')).toBeInTheDocument()
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('has a link to the login page', () => {
    renderSignup();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
