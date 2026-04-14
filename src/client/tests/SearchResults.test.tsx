import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchResults from '../components/SearchResults';
import type { Card } from '../components/CardImage';

const cardA: Card = { id: 'a1', name: 'Counterspell', imageUrl: 'https://example.com/counter.jpg', faces: [] };
const cardB: Card = { id: 'b1', name: 'Brainstorm', imageUrl: 'https://example.com/brain.jpg', faces: [] };

const noOp = () => {};

const defaultProps = {
  results: [cardA],
  currentCards: [],
  pendingAdds: new Set<string>(),
  pendingRemoves: new Set<string>(),
  viewMode: 'list' as const,
  activeSearch: 'counter',
  isFetching: false,
  onAdd: noOp,
  onRemove: noOp,
  onUndo: noOp,
};

describe('SearchResults — list mode', () => {
  it('shows Add button for a card not in the deck', () => {
    render(<SearchResults {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('calls onAdd with the full card object when Add is clicked', async () => {
    const onAdd = jest.fn();
    render(<SearchResults {...defaultProps} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd).toHaveBeenCalledWith(cardA);
  });

  it('shows Remove button for a card already in the deck', () => {
    render(<SearchResults {...defaultProps} currentCards={[cardA]} />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('calls onRemove with card id when Remove is clicked', async () => {
    const onRemove = jest.fn();
    render(<SearchResults {...defaultProps} currentCards={[cardA]} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('shows Undo button for a staged add', () => {
    render(<SearchResults {...defaultProps} pendingAdds={new Set(['a1'])} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('calls onUndo with card id when Undo is clicked for a staged add', async () => {
    const onUndo = jest.fn();
    render(<SearchResults {...defaultProps} pendingAdds={new Set(['a1'])} onUndo={onUndo} />);
    await userEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledWith('a1');
  });

  it('shows "staged to add" secondary text for a pending add', () => {
    render(<SearchResults {...defaultProps} pendingAdds={new Set(['a1'])} />);
    expect(screen.getByText('staged to add')).toBeInTheDocument();
  });

  it('shows "staged to remove" secondary text when card is pending removal', () => {
    render(
      <SearchResults
        {...defaultProps}
        currentCards={[cardA]}
        pendingRemoves={new Set(['a1'])}
      />
    );
    expect(screen.getByText('staged to remove')).toBeInTheDocument();
  });

  it('shows "in deck" secondary text for a card in the deck with no pending change', () => {
    render(<SearchResults {...defaultProps} currentCards={[cardA]} />);
    expect(screen.getByText('in deck')).toBeInTheDocument();
  });

  it('shows "No results found." when search returned nothing', () => {
    render(<SearchResults {...defaultProps} results={[]} />);
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('does not show "No results found." when there is no active search', () => {
    render(<SearchResults {...defaultProps} results={[]} activeSearch="" />);
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument();
  });

  it('renders multiple results', () => {
    render(<SearchResults {...defaultProps} results={[cardA, cardB]} />);
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
  });
});

describe('SearchResults — image mode', () => {
  it('renders card images for each result', () => {
    render(
      <SearchResults
        {...defaultProps}
        results={[cardA, cardB]}
        viewMode="images"
      />
    );
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('shows "No results found." text in image mode when search returned nothing', () => {
    render(<SearchResults {...defaultProps} results={[]} viewMode="images" />);
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });
});
