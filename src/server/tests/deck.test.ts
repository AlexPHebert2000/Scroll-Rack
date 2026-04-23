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
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    branch: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    decklist: {
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    deckCard: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    commit: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    change: {
      deleteMany: jest.fn(),
    },
    snapShot: {
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    card: {
      findMany: jest.fn(),
    },
    session: {
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const db = prisma as {
  deck: { create: jest.Mock; findUniqueOrThrow: jest.Mock; findFirstOrThrow: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  branch: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findFirstOrThrow: jest.Mock; findMany: jest.Mock; count: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
  decklist: { delete: jest.Mock; deleteMany: jest.Mock };
  deckCard: { createMany: jest.Mock; deleteMany: jest.Mock };
  commit: { findMany: jest.Mock; deleteMany: jest.Mock };
  change: { deleteMany: jest.Mock };
  snapShot: { deleteMany: jest.Mock; delete: jest.Mock };
  card: { findMany: jest.Mock };
  session: { findUniqueOrThrow: jest.Mock };
  $transaction: jest.Mock;
};

const SESSION_COOKIE = 'scroll-rack-session=test-session-id';
const VALID_SESSION = { userEmail: 'user@test.com', expires: new Date(Date.now() + 86400000) };

const emptyDecklist = { id: 'dlist-1', deckCards: [] };

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  db.session.findUniqueOrThrow.mockResolvedValue(VALID_SESSION);
  db.deckCard.createMany.mockResolvedValue({ count: 0 });
  db.deckCard.deleteMany.mockResolvedValue({ count: 0 });
});

// ---------------------------------------------------------------------------
// POST /api/deck — create deck
// ---------------------------------------------------------------------------

describe('POST /api/deck', () => {
  it('returns 201 on successful deck creation', async () => {
    db.deck.create.mockResolvedValueOnce({ id: 'deck-1' });

    const res = await request(app)
      .post('/api/deck')
      .set('Cookie', SESSION_COOKIE)
      .send({ name: 'My Deck', description: 'A test deck' });

    expect(res.status).toBe(201);
    expect(res.body.deckId).toBeDefined();
  });

  it('returns 500 when creation fails', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/deck')
      .set('Cookie', SESSION_COOKIE)
      .send({ name: 'My Deck' });

    expect(res.status).toBe(500);
  });

  it('returns 401 when no session cookie is present', async () => {
    const res = await request(app)
      .post('/api/deck')
      .send({ name: 'My Deck' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/deck/:id/:branch — fetch deck
// ---------------------------------------------------------------------------

describe('GET /api/deck/:id/:branch', () => {
  beforeEach(() => {
    db.branch.findMany.mockResolvedValue([{ id: 'branch-1', name: 'main' }]);
  });

  it('returns 200 with deck data including allBranches and resolved card arrays', async () => {
    db.deck.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'deck-1',
      name: 'My Deck',
      branches: [{
        id: 'branch-1',
        decklist: {
          id: 'dlist-1',
          deckCards: [
            { board: 'MAIN', count: 1, card: { id: 'card-a', name: 'Lightning Bolt', faces: [] } },
          ],
        },
        commits: [],
      }],
    });

    const res = await request(app)
      .get('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('deck-1');
    expect(res.body.allBranches).toEqual([{ id: 'branch-1', name: 'main' }]);
    expect(res.body.branches[0].decklist.mainDeck[0].id).toBe('card-a');
  });

  it('expands count > 1 into duplicate card entries', async () => {
    db.deck.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'deck-1',
      name: 'My Deck',
      branches: [{
        id: 'branch-1',
        decklist: {
          id: 'dlist-1',
          deckCards: [
            { board: 'MAIN', count: 3, card: { id: 'card-a', name: 'Lightning Bolt', faces: [] } },
          ],
        },
        commits: [],
      }],
    });

    const res = await request(app)
      .get('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE);

    expect(res.body.branches[0].decklist.mainDeck).toHaveLength(3);
    expect(res.body.branches[0].decklist.mainDeck.every((c: any) => c.id === 'card-a')).toBe(true);
  });

  it('filters by branch id when branch param is provided', async () => {
    db.deck.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'deck-1', name: 'My Deck',
      branches: [{ id: 'branch-abc', decklist: emptyDecklist, commits: [] }],
    });

    await request(app)
      .get('/api/deck/deck-1/branch-abc')
      .set('Cookie', SESSION_COOKIE);

    expect(db.deck.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          branches: expect.objectContaining({ where: { id: 'branch-abc' } }),
        }),
      })
    );
  });

  it('defaults to main branch when no branch param is provided', async () => {
    db.deck.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'deck-1', name: 'My Deck',
      branches: [{ id: 'branch-1', decklist: emptyDecklist, commits: [] }],
    });

    await request(app)
      .get('/api/deck/deck-1')
      .set('Cookie', SESSION_COOKIE);

    expect(db.deck.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          branches: expect.objectContaining({ where: { name: 'main' } }),
        }),
      })
    );
  });

  it('returns 404 when deck is not found', async () => {
    const notFound = new Error('Not found');
    notFound.name = 'PrismaClientKnownRequestError';
    (notFound as any).meta = { cause: 'Record to find not found' };
    db.deck.findUniqueOrThrow.mockRejectedValueOnce(notFound);

    const res = await request(app)
      .get('/api/deck/bad-id/branch-1')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/deck/:id/:branch — commit changes
// ---------------------------------------------------------------------------

describe('POST /api/deck/:id/:branch', () => {
  it('returns 201 on successful commit', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1', decklistId: 'dlist-1' }] });

    const res = await request(app)
      .post('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'Add some cards',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-1' }],
        mainDeck: ['card-1'],
        sideBoard: [],
      });

    expect(res.status).toBe(201);
  });

  it('uses the branch id (not deck id) when updating (regression)', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-abc', decklistId: 'dlist-1' }] });

    await request(app)
      .post('/api/deck/deck-1/branch-abc')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'fix',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-1' }],
        mainDeck: ['card-1'],
        sideBoard: [],
      });

    expect(db.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'branch-abc' } })
    );
  });

  it('replaces decklist via deckCard deleteMany then createMany', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1', decklistId: 'dlist-1' }] });

    await request(app)
      .post('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'Remove a card',
        changes: [{ action: 'REMOVE', board: 'MAIN', cardId: 'card-old' }],
        mainDeck: ['card-keep'],
        sideBoard: [],
      });

    expect(db.deckCard.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { decklistId: 'dlist-1', board: 'MAIN' } })
    );
    expect(db.deckCard.createMany).toHaveBeenCalledWith({
      data: [{ decklistId: 'dlist-1', cardId: 'card-keep', board: 'MAIN', count: 1 }],
    });
  });

  it('creates DeckCard entries with count > 1 for duplicate card ids in mainDeck', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1', decklistId: 'dlist-1' }] });

    await request(app)
      .post('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'Add 3 copies',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-a', count: 3 }],
        mainDeck: ['card-a', 'card-a', 'card-a'],
        sideBoard: [],
      });

    expect(db.deckCard.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ cardId: 'card-a', board: 'MAIN', count: 3 }),
      ]),
    });
  });

  it('sets headCommitId to match the new commit id', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1', decklistId: 'dlist-1' }] });

    await request(app)
      .post('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'test',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-1' }],
        mainDeck: ['card-1'],
        sideBoard: [],
      });

    const commitCallArgs = db.branch.update.mock.calls[0][0];
    const headCallArgs = db.branch.update.mock.calls[1][0];
    expect(headCallArgs.data.headCommitId).toBe(commitCallArgs.data.commits.create.id);
  });

  it('records commit history with changes in the branch.update call', async () => {
    db.deck.findFirstOrThrow.mockResolvedValueOnce({ id: 'deck-1', branches: [{ id: 'branch-1', decklistId: 'dlist-1' }] });

    await request(app)
      .post('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'Add a card',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-1' }],
        mainDeck: ['card-1'],
        sideBoard: [],
      });

    expect(db.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commits: {
            create: expect.objectContaining({
              description: 'Add a card',
              changes: {
                create: expect.arrayContaining([
                  expect.objectContaining({ action: 'ADD', board: 'MAIN' }),
                ]),
              },
            }),
          },
        }),
      })
    );
  });

  it('returns 404 when deck or branch is not found', async () => {
    const notFound: any = new Error('Not found');
    notFound.code = 'P2025';
    db.deck.findFirstOrThrow.mockRejectedValueOnce(notFound);

    const res = await request(app)
      .post('/api/deck/bad-deck/bad-branch')
      .set('Cookie', SESSION_COOKIE)
      .send({
        description: 'nope',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-1' }],
        mainDeck: ['card-1'],
        sideBoard: [],
      });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/deck/:id/branch — create a new branch from a historical commit
// ---------------------------------------------------------------------------

describe('POST /api/deck/:id/branch', () => {
  const sourceBranch = {
    id: 'branch-1',
    commits: [
      { id: 'commit-1', description: 'INIT',           changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-a', count: 1 }] },
      { id: 'commit-2', description: 'Add fetchlands',  changes: [{ action: 'ADD', board: 'MAIN', cardId: 'card-b', count: 1 }] },
      { id: 'commit-3', description: 'Remove card-a',   changes: [{ action: 'REMOVE', board: 'MAIN', cardId: 'card-a', count: 1 }] },
    ],
  };

  it('returns 201 with branchId and branchName on success', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    const res = await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-2' });

    expect(res.status).toBe(201);
    expect(res.body.branchId).toBeDefined();
    expect(res.body.branchName).toBeDefined();
  });

  it('uses a custom branchName when provided', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    const res = await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-2', branchName: 'my-custom-branch' });

    expect(res.body.branchName).toBe('my-custom-branch');
  });

  it('auto-generates a slug name from the commit description when no name given', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    const res = await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-2' });

    expect(res.body.branchName).toBe('add-fetchlands');
  });

  it('seeds the new branch decklist via deckCard.createMany at the target commit', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-2' });

    // After commit-1 (add card-a) and commit-2 (add card-b): MAIN = {card-a, card-b}
    expect(db.deckCard.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ cardId: 'card-a', board: 'MAIN', count: 1 }),
        expect.objectContaining({ cardId: 'card-b', board: 'MAIN', count: 1 }),
      ]),
    });
  });

  it('replays REMOVE actions correctly — card-a is gone after commit-3', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-3' });

    const deckCardCall = db.deckCard.createMany.mock.calls[0][0];
    const cardIds = deckCardCall.data.map((d: any) => d.cardId);
    expect(cardIds).toContain('card-b');
    expect(cardIds).not.toContain('card-a');
  });

  it('sets headCommitId on the new branch to the seed commit', async () => {
    db.branch.findFirstOrThrow.mockResolvedValueOnce(sourceBranch);
    db.branch.create.mockResolvedValueOnce({ id: 'new-branch' });

    await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'commit-1' });

    const createArgs = db.branch.create.mock.calls[0][0];
    const updateArgs = db.branch.update.mock.calls[0][0];
    expect(updateArgs.data.headCommitId).toBe(createArgs.data.commits.create.id);
  });

  it('returns 404 when sourceCommitId does not belong to the deck', async () => {
    const notFound: any = new Error('Not found');
    notFound.code = 'P2025';
    db.branch.findFirstOrThrow.mockRejectedValueOnce(notFound);

    const res = await request(app)
      .post('/api/deck/deck-1/branch')
      .set('Cookie', SESSION_COOKIE)
      .send({ sourceCommitId: 'bad-commit' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/deck/:id — delete deck with cascade
// ---------------------------------------------------------------------------

describe('DELETE /api/deck/:id', () => {
  it('returns 204 and cascades deletions manually', async () => {
    db.branch.findMany.mockResolvedValueOnce([
      { id: 'branch-1', decklistId: 'dlist-1' },
      { id: 'branch-2', decklistId: 'dlist-2' },
    ]);
    db.commit.findMany.mockResolvedValueOnce([{ id: 'commit-1' }, { id: 'commit-2' }]);
    db.deck.delete.mockResolvedValueOnce({});

    const res = await request(app)
      .delete('/api/deck/deck-1')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(204);
    expect(db.change.deleteMany).toHaveBeenCalledWith({ where: { commitId: { in: ['commit-1', 'commit-2'] } } });
    expect(db.deckCard.deleteMany).toHaveBeenCalledWith({ where: { decklistId: { in: ['dlist-1', 'dlist-2'] } } });
    expect(db.commit.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['commit-1', 'commit-2'] } } });
    expect(db.deck.delete).toHaveBeenCalledWith({ where: { id: 'deck-1' } });
  });

  it('returns 404 when deck is not found', async () => {
    db.branch.findMany.mockResolvedValueOnce([]);
    db.deck.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/deck/deck-not-found')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/deck/deck-1');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/deck/:id/:branch — delete branch with cascade
// ---------------------------------------------------------------------------

describe('DELETE /api/deck/:id/:branch', () => {
  it('returns 204 and cascades deletions manually', async () => {
    db.branch.findFirst.mockResolvedValueOnce({ decklistId: 'dlist-1' });
    db.branch.count.mockResolvedValueOnce(3);
    db.commit.findMany.mockResolvedValueOnce([{ id: 'commit-1' }]);
    db.branch.delete.mockResolvedValueOnce({});
    db.decklist.delete.mockResolvedValueOnce({});

    const res = await request(app)
      .delete('/api/deck/deck-1/branch-1')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(204);
    expect(db.change.deleteMany).toHaveBeenCalled();
    expect(db.deckCard.deleteMany).toHaveBeenCalledWith({ where: { decklistId: 'dlist-1' } });
    expect(db.branch.delete).toHaveBeenCalledWith({ where: { id: 'branch-1' } });
  });

  it('returns 400 when trying to delete the last branch', async () => {
    db.branch.findFirst.mockResolvedValueOnce({ decklistId: 'dlist-1' });
    db.branch.count.mockResolvedValueOnce(1);

    const res = await request(app)
      .delete('/api/deck/deck-1/only-branch')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(400);
  });

  it('returns 404 when branch is not found', async () => {
    db.branch.findFirst.mockResolvedValueOnce(null);
    db.branch.count.mockResolvedValueOnce(2);

    const res = await request(app)
      .delete('/api/deck/deck-1/bad-branch')
      .set('Cookie', SESSION_COOKIE);

    expect(res.status).toBe(404);
  });
});
