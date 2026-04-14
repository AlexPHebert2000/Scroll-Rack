import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DecklistCards from '../components/DecklistCards';
import type { Card } from '../components/CardImage';

const card1: Card = { id: 'c1', name: 'Lightning Bolt', imageUrl: 'https://example.com/bolt.jpg', faces: [] };
const card2: Card = { id: 'c2', name: 'Dark Ritual', imageUrl: 'https://example.com/ritual.jpg', faces: [] };

const noOp = () => {};

describe('DecklistCards — list mode', () => {
  it('renders all current card names', () => {
    render(
      <DecklistCards
        currentCards={[card1, card2]}
        addedCards={[]}
        pendingRemoves={new Set()}
        viewMode="list"
        onRemove={noOp}
        onUndo={noOp}
      />
    );
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByText('Dark Ritual')).toBeInTheDocument();
  });

  it('shows Undo button and strikethrough for cards pending removal', () => {
    render(
      <DecklistCards
        currentCards={[card1]}
        addedCards={[]}
        pendingRemoves={new Set(['c1'])}
        viewMode="list"
        onRemove={noOp}
        onUndo={noOp}
      />
    );
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    const item = screen.getByText('Lightning Bolt').closest('li');
    expect(item).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('calls onUndo with card id when Undo is clicked for a pending removal', async () => {
    const onUndo = jest.fn();
    render(
      <DecklistCards
        currentCards={[card1]}
        addedCards={[]}
        pendingRemoves={new Set(['c1'])}
        viewMode="list"
        onRemove={noOp}
        onUndo={onUndo}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledWith('c1');
  });

  it('calls onRemove with card id when remove button is clicked', async () => {
    const onRemove = jest.fn();
    render(
      <DecklistCards
        currentCards={[card1]}
        addedCards={[]}
        pendingRemoves={new Set()}
        viewMode="list"
        onRemove={onRemove}
        onUndo={noOp}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('renders added cards with + prefix', () => {
    render(
      <DecklistCards
        currentCards={[]}
        addedCards={[card1]}
        pendingRemoves={new Set()}
        viewMode="list"
        onRemove={noOp}
        onUndo={noOp}
      />
    );
    expect(screen.getByText('+ Lightning Bolt')).toBeInTheDocument();
  });
});

describe('DecklistCards — image mode', () => {
  it('renders card images for all current cards', () => {
    render(
      <DecklistCards
        currentCards={[card1, card2]}
        addedCards={[]}
        pendingRemoves={new Set()}
        viewMode="images"
        onRemove={noOp}
        onUndo={noOp}
      />
    );
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  it('renders card images for added cards', () => {
    render(
      <DecklistCards
        currentCards={[card1]}
        addedCards={[card2]}
        pendingRemoves={new Set()}
        viewMode="images"
        onRemove={noOp}
        onUndo={noOp}
      />
    );
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });
});
