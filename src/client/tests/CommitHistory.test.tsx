import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommitHistory from '../components/CommitHistory';
import type { Commit } from '../components/CommitHistory';

const noOp = () => {};

const commit1: Commit = {
  id: 'abc1',
  description: 'Add fetchlands',
  createdAt: '2026-01-01T12:00:00Z',
  changes: [
    { action: 'add', card: { id: 'c1', name: 'Polluted Delta' } },
    { action: 'remove', card: { id: 'c2', name: 'Island' } },
  ],
};

const commit2: Commit = {
  id: 'abc2',
  description: 'INIT',
  createdAt: '2025-12-01T12:00:00Z',
  changes: [],
};

const renderHistory = (commits: Commit[] = [], open = true) =>
  render(
    <CommitHistory open={open} onClose={noOp} branchName="main" commits={commits} />
  );

describe('CommitHistory', () => {
  it('shows "No commits yet." when the commit list is empty', () => {
    renderHistory([]);
    expect(screen.getByText('No commits yet.')).toBeInTheDocument();
  });

  it('renders commit descriptions', () => {
    renderHistory([commit1, commit2]);
    expect(screen.getByText('Add fetchlands')).toBeInTheDocument();
    expect(screen.getByText('INIT')).toBeInTheDocument();
  });

  it('does not show changes before a commit is clicked', () => {
    renderHistory([commit1]);
    expect(screen.queryByText('Polluted Delta')).not.toBeInTheDocument();
  });

  it('expands to show changes when a commit is clicked', async () => {
    renderHistory([commit1]);
    await userEvent.click(screen.getByText('Add fetchlands'));
    expect(screen.getByText(/Polluted Delta/)).toBeInTheDocument();
    expect(screen.getByText(/Island/)).toBeInTheDocument();
  });

  it('shows added cards with a + prefix', async () => {
    renderHistory([commit1]);
    await userEvent.click(screen.getByText('Add fetchlands'));
    expect(screen.getByText(/\+ Polluted Delta/)).toBeInTheDocument();
  });

  it('shows removed cards with a − prefix', async () => {
    renderHistory([commit1]);
    await userEvent.click(screen.getByText('Add fetchlands'));
    expect(screen.getByText(/− Island/)).toBeInTheDocument();
  });

  it('shows "No changes recorded." for a commit with an empty changes list', async () => {
    renderHistory([commit2]);
    await userEvent.click(screen.getByText('INIT'));
    expect(screen.getByText('No changes recorded.')).toBeInTheDocument();
  });


});
