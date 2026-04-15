import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommitHistory from '../components/CommitHistory';
import type { Commit } from '../components/CommitHistory';

const noOp = () => {};
const noOpBranchFrom = jest.fn();

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
    <CommitHistory open={open} onClose={noOp} branchName="main" commits={commits} onBranchFrom={noOpBranchFrom} />
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

// ---------------------------------------------------------------------------
// Branch here button behaviour
// ---------------------------------------------------------------------------

describe('CommitHistory — Branch here', () => {
  beforeEach(() => noOpBranchFrom.mockClear());

  it('does not show a "Branch here" button on the HEAD commit (index 0)', () => {
    renderHistory([commit1, commit2]);
    expect(screen.queryByRole('button', { name: /branch from add fetchlands/i })).not.toBeInTheDocument();
  });

  it('shows a "Branch here" button on non-HEAD commits', () => {
    renderHistory([commit1, commit2]);
    expect(screen.getByRole('button', { name: /branch from init/i })).toBeInTheDocument();
  });

  it('opens a confirmation dialog when "Branch here" is clicked', async () => {
    renderHistory([commit1, commit2]);
    await userEvent.click(screen.getByRole('button', { name: /branch from init/i }));
    expect(screen.getByText('New Branch')).toBeInTheDocument();
  });

  it('pre-fills the branch name with a slug of the commit description', async () => {
    renderHistory([commit1, commit2]);
    await userEvent.click(screen.getByRole('button', { name: /branch from init/i }));
    expect(screen.getByDisplayValue('init')).toBeInTheDocument();
  });

  it('calls onBranchFrom with commitId and branchName when Create Branch is clicked', async () => {
    renderHistory([commit1, commit2]);
    await userEvent.click(screen.getByRole('button', { name: /branch from init/i }));
    await userEvent.click(screen.getByRole('button', { name: /create branch/i }));
    expect(noOpBranchFrom).toHaveBeenCalledWith({ commitId: commit2.id, branchName: 'init' });
  });

  it('allows editing the branch name before confirming', async () => {
    renderHistory([commit1, commit2]);
    await userEvent.click(screen.getByRole('button', { name: /branch from init/i }));
    const input = screen.getByDisplayValue('init');
    await userEvent.clear(input);
    await userEvent.type(input, 'my-custom-branch');
    await userEvent.click(screen.getByRole('button', { name: /create branch/i }));
    expect(noOpBranchFrom).toHaveBeenCalledWith({ commitId: commit2.id, branchName: 'my-custom-branch' });
  });

  it('does not call onBranchFrom when Cancel is clicked', async () => {
    renderHistory([commit1, commit2]);
    await userEvent.click(screen.getByRole('button', { name: /branch from init/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(noOpBranchFrom).not.toHaveBeenCalled();
  });
});
