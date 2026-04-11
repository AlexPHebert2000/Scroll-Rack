import request from 'supertest';
import app from '../app';
import prisma from '../db';

jest.mock('../db', () => ({
  __esModule: true,
  default: {
    deck: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    branch: {
      update: jest.fn(),
    },
  },
}));

const db = prisma as {
  deck: { create: jest.Mock; findUniqueOrThrow: jest.Mock; findFirstOrThrow: jest.Mock };
  branch: { update: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/deck — create deck
// ---------------------------------------------------------------------------

describe('POST /api/deck', () => {
  it('returns 201 on successful deck creation', async () => {
    db.deck.create.mockResolvedValueOnce({ id: 'deck-1' });

    const res = await request(app)
      .post('/api/deck')
      .send({ name: 'My Deck', userId: 'user@test.com', description: 'A test deck' });

    expect(res.status).toBe(201);
  });

  it('returns 500 when creation fails', async () => {
    db.deck.create.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/deck')
      .send({ name: 'My Deck', userId: 'user@test.com' });

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/deck/:id/:branch — fetch deck
// ---------------------------------------------------------------------------

describe('GET /api/deck/:id/:branch', () => {
  it('returns 200 with deck data', async () => {
    db.deck.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'deck-1',
      name: 'My Deck',
      branches: [{ id: 'branch-1', cards: [] }],
    });

    const res = await request(app).get('/api/deck/deck-1/branch-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('deck-1');
  });

  it('returns 404 when deck is not found', async () => {
    const notFound = new Error('Not found');
    notFound.name = 'PrismaClientKnownRequestError';
    (notFound as any).meta = { cause: 'Record to find not found' };
    db.deck.findUniqueOrThrow.mockRejectedValueOnce(notFound);

    const res = await request(app).get('/api/deck/bad-id/branch-1');

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/deck/:id/:branch — commit changes
// ---------------------------------------------------------------------------

describe('POST /api/deck/:id/:branch', () => {
  it('returns 201 on successful commit', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1' }] });
    db.branch.update.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/deck/deck-1/branch-1')
      .send({
        description: 'Add some cards',
        changes: [{ action: 'add', cardId: 'card-1' }],
        decklist: ['card-1'],
      });

    expect(res.status).toBe(201);
  });

  it('uses the branch id (not deck id) when updating (regression)', async () => {
    // This test ensures branch.update is called with the branch id from the URL
    // and not accidentally with the deck id.
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-abc' }] });
    db.branch.update.mockResolvedValueOnce({});

    await request(app)
      .post('/api/deck/deck-1/branch-abc')
      .send({ description: 'fix', changes: [], decklist: [] });

    expect(db.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'branch-abc' } })
    );
  });

  it('returns 404 when deck or branch is not found', async () => {
    const notFound: any = new Error('Not found');
    notFound.code = 'P2025';
    db.deck.findFirstOrThrow.mockRejectedValueOnce(notFound);

    const res = await request(app)
      .post('/api/deck/bad-deck/bad-branch')
      .send({ description: 'nope', changes: [], decklist: [] });

    expect(res.status).toBe(404);
  });
});
