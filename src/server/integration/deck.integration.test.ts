import request from 'supertest';
import app from '../app';
import prisma from '../db';

const SESSION_ID = 'integ-session';
const COOKIE = `scroll-rack-session=${SESSION_ID}`;
const USER_EMAIL = 'integ@test.com';
const CARD_ID = 'integ-card-1';

const COLLECTIONS = ['Change', 'SnapShot', 'Commit', 'Branch', 'Decklist', 'Deck', 'CardFace', 'Card', 'Session', 'User'];

beforeEach(async () => {
  await Promise.all(
    COLLECTIONS.map(col => prisma.$runCommandRaw({ delete: col, deletes: [{ q: {}, limit: 0 }] }))
  );

  await prisma.user.create({
    data: { email: USER_EMAIL, username: 'integuser', name: 'Integration User', password: 'x' },
  });
  await prisma.session.create({
    data: { id: SESSION_ID, userEmail: USER_EMAIL, expires: new Date(Date.now() + 86400000) },
  });
});

afterAll(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// POST /api/deck
// ---------------------------------------------------------------------------

describe('POST /api/deck — integration', () => {
  it('creates a deck with headCommitId set on the branch', async () => {
    const res = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Test Deck' });

    expect(res.status).toBe(201);

    const branch = await prisma.branch.findFirst({ where: { deckId: res.body.deckId } });
    expect(branch?.headCommitId).toBeDefined();
    expect(branch?.headCommitId).not.toBeNull();
  });

  it('headCommitId points to the INIT commit', async () => {
    const res = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Test Deck' });

    const branch = await prisma.branch.findFirst({ where: { deckId: res.body.deckId } });
    const commit = await prisma.commit.findUnique({ where: { id: branch!.headCommitId! } });
    expect(commit?.description).toBe('INIT');
  });

  it('creating two decks does not violate the headCommitId unique constraint', async () => {
    const res1 = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Deck One' });

    const res2 = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Deck Two' });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const branches = await prisma.branch.findMany();
    expect(branches).toHaveLength(2);
    const headIds = branches.map(b => b.headCommitId);
    expect(headIds[0]).not.toBeNull();
    expect(headIds[1]).not.toBeNull();
    expect(headIds[0]).not.toBe(headIds[1]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/deck/:id/branch
// ---------------------------------------------------------------------------

describe('POST /api/deck/:id/branch — integration', () => {
  let deckId: string;
  let sourceCommitId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Source Deck' });
    deckId = res.body.deckId;

    const branch = await prisma.branch.findFirst({
      where: { deckId },
      include: { commits: true },
    });
    sourceCommitId = branch!.commits[0].id;
  });

  it('creates a branch with headCommitId set', async () => {
    const res = await request(app)
      .post(`/api/deck/${deckId}/branch`)
      .set('Cookie', COOKIE)
      .send({ sourceCommitId, branchName: 'new-branch' });

    expect(res.status).toBe(201);

    const branch = await prisma.branch.findUnique({ where: { id: res.body.branchId } });
    expect(branch?.headCommitId).toBeDefined();
    expect(branch?.headCommitId).not.toBeNull();
  });

  it('creating two branches does not violate the headCommitId unique constraint', async () => {
    const res1 = await request(app)
      .post(`/api/deck/${deckId}/branch`)
      .set('Cookie', COOKIE)
      .send({ sourceCommitId, branchName: 'branch-a' });

    const res2 = await request(app)
      .post(`/api/deck/${deckId}/branch`)
      .set('Cookie', COOKIE)
      .send({ sourceCommitId, branchName: 'branch-b' });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const newBranches = await prisma.branch.findMany({
      where: { id: { in: [res1.body.branchId, res2.body.branchId] } },
    });
    expect(newBranches).toHaveLength(2);
    expect(newBranches[0].headCommitId).not.toBeNull();
    expect(newBranches[1].headCommitId).not.toBeNull();
    expect(newBranches[0].headCommitId).not.toBe(newBranches[1].headCommitId);
  });
});

// ---------------------------------------------------------------------------
// POST /api/deck/:id/:branch
// ---------------------------------------------------------------------------

describe('POST /api/deck/:id/:branch — integration', () => {
  let deckId: string;
  let branchId: string;
  let originalHeadCommitId: string;

  beforeEach(async () => {
    await prisma.card.create({ data: { id: CARD_ID, name: 'Test Card' } });

    const deckRes = await request(app)
      .post('/api/deck')
      .set('Cookie', COOKIE)
      .send({ name: 'Commit Test Deck' });
    deckId = deckRes.body.deckId;

    const branch = await prisma.branch.findFirst({ where: { deckId } });
    branchId = branch!.id;
    originalHeadCommitId = branch!.headCommitId!;
  });

  it('updates headCommitId to the new commit after a commit', async () => {
    const res = await request(app)
      .post(`/api/deck/${deckId}/${branchId}`)
      .set('Cookie', COOKIE)
      .send({
        description: 'Add test card',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: CARD_ID }],
        mainDeck: [CARD_ID],
        sideBoard: [],
        commander: [],
      });

    expect(res.status).toBe(201);

    const updated = await prisma.branch.findUnique({ where: { id: branchId } });
    expect(updated?.headCommitId).not.toBe(originalHeadCommitId);
    expect(updated?.headCommitId).not.toBeNull();
  });

  it('new headCommitId references the correct commit description', async () => {
    await request(app)
      .post(`/api/deck/${deckId}/${branchId}`)
      .set('Cookie', COOKIE)
      .send({
        description: 'My commit message',
        changes: [{ action: 'ADD', board: 'MAIN', cardId: CARD_ID }],
        mainDeck: [CARD_ID],
        sideBoard: [],
        commander: [],
      });

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const commit = await prisma.commit.findUnique({ where: { id: branch!.headCommitId! } });
    expect(commit?.description).toBe('My commit message');
  });
});
