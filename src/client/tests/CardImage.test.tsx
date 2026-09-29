import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardImage, { cardDisplayName } from '../components/CardImage';
import type { Card, CardArt } from '../components/CardImage';

const makeArt = (imageUrl: string | null, faces?: { name: string; imageUrl: string | null; artCropUrl: string | null }[]): CardArt => ({
  id: 'art-1', oracleId: 'oracle-1', name: 'Test', imageUrl, artCropUrl: null,
  set: null, setName: null, artist: null, faces: faces ?? [],
});

const singleFaceCard: Card = {
  id: 'card-1',
  name: 'Lightning Bolt',
  faces: [],
  defaultArt: makeArt('https://example.com/bolt.jpg'),
};

const noImageCard: Card = {
  id: 'card-2',
  name: 'Dark Ritual',
  faces: [],
  defaultArt: makeArt(null),
};

const doubleFacedCard: Card = {
  id: 'card-3',
  name: 'Delver of Secrets',
  faces: [
    { name: 'Delver of Secrets' },
    { name: 'Insectile Aberration' },
  ],
  defaultArt: makeArt(null, [
    { name: 'Delver of Secrets', imageUrl: 'https://example.com/delver-front.jpg', artCropUrl: null },
    { name: 'Insectile Aberration', imageUrl: 'https://example.com/delver-back.jpg', artCropUrl: null },
  ]),
};

describe('cardDisplayName', () => {
  it('returns card.name for a single-face card', () => {
    expect(cardDisplayName({ id: 'x', name: 'Lightning Bolt', faces: [] })).toBe('Lightning Bolt');
  });

  it('joins face names with " // " for a multi-face card', () => {
    const card: Card = {
      id: 'x',
      name: 'Delver of Secrets',
      faces: [
        { name: 'Delver of Secrets' },
        { name: 'Insectile Aberration' },
      ],
    };
    expect(cardDisplayName(card)).toBe('Delver of Secrets // Insectile Aberration');
  });

  it('falls back to card.name when faces is an empty array', () => {
    expect(cardDisplayName({ id: 'x', name: 'Dark Ritual', faces: [] })).toBe('Dark Ritual');
  });

  it('does not throw when faces is undefined', () => {
    expect(() =>
      cardDisplayName({ id: 'x', name: 'Fireball', faces: undefined as any })
    ).not.toThrow();
  });
});

describe('CardImage', () => {
  it('renders the card image when imageUrl is present', () => {
    render(<CardImage card={singleFaceCard} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/bolt.jpg');
    expect(img).toHaveAttribute('alt', 'Lightning Bolt');
  });

  it('renders a text placeholder when imageUrl is null', () => {
    render(<CardImage card={noImageCard} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Dark Ritual')).toBeInTheDocument();
  });

  it('does not show the flip button for single-face cards', () => {
    render(<CardImage card={singleFaceCard} />);
    expect(screen.queryByTitle(/Show.*face/i)).not.toBeInTheDocument();
  });

  it('shows the flip button for double-faced cards', () => {
    render(<CardImage card={doubleFacedCard} />);
    expect(screen.getByTitle('Show back face')).toBeInTheDocument();
  });

  it('starts on the front face for double-faced cards', () => {
    render(<CardImage card={doubleFacedCard} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/delver-front.jpg');
  });

  it('toggles to the back face when flip button is clicked', async () => {
    render(<CardImage card={doubleFacedCard} />);
    await userEvent.click(screen.getByTitle('Show back face'));
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/delver-back.jpg');
    expect(screen.getByTitle('Show front face')).toBeInTheDocument();
  });

  it('toggles back to the front face on second click', async () => {
    render(<CardImage card={doubleFacedCard} />);
    await userEvent.click(screen.getByTitle('Show back face'));
    await userEvent.click(screen.getByTitle('Show front face'));
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/delver-front.jpg');
  });

  it('renders the action slot with card-overlay class', () => {
    const action = <button>Add</button>;
    const { container } = render(<CardImage card={singleFaceCard} action={action} />);
    const overlay = container.querySelector('.card-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent('Add');
  });

  it('applies card-overlay class to the flip button', () => {
    const { container } = render(<CardImage card={doubleFacedCard} />);
    const flipButton = container.querySelector('button.card-overlay');
    expect(flipButton).toBeInTheDocument();
  });

  it('uses the passed art prop over defaultArt', () => {
    const overrideArt = makeArt('https://example.com/alt.jpg');
    render(<CardImage card={singleFaceCard} art={overrideArt} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/alt.jpg');
  });
});
