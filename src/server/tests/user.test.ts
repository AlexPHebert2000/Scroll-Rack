import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import prisma from '../db';

jest.mock('../db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    session: {
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const db = prisma as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; findFirstOrThrow: jest.Mock };
  session: { findUniqueOrThrow: jest.Mock; create: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/user — register
// ---------------------------------------------------------------------------

describe('POST /api/user', () => {
  it('returns 201 on successful registration', async () => {
    db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    db.user.create.mockResolvedValueOnce({ username: 'testuser' });

    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'test@test.com', username: 'testuser', password: 'password123' });

    expect(res.status).toBe(201);
  });

  it('hashes the password before storing', async () => {
    db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    db.user.create.mockResolvedValueOnce({ username: 'testuser' });

    await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'test@test.com', username: 'testuser', password: 'plaintextpassword' });

    expect(bcrypt.hash).toHaveBeenCalledWith('plaintextpassword', 10);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: 'hashed_password' }),
      })
    );
  });

  it('returns 409 when email is already taken', async () => {
    db.user.findUnique.mockResolvedValueOnce({ email: 'test@test.com' });

    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'test@test.com', username: 'testuser', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('returns 409 when username is already taken', async () => {
    db.user.findUnique
      .mockResolvedValueOnce(null)                       // email free
      .mockResolvedValueOnce({ username: 'testuser' });  // username taken

    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'new@test.com', username: 'testuser', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'test@test.com', username: 'testuser', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when username is invalid', async () => {
    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Test', email: 'test@test.com', username: 'ab', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/login
// ---------------------------------------------------------------------------

describe('POST /api/user/login', () => {
  it('returns 200 and sets an httpOnly cookie on success with email', async () => {
    db.user.findFirst.mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', password: 'hashed' });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    db.session.create.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/user/login')
      .send({ identifier: 'test@test.com', password: 'password' });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('scroll-rack-session');
    expect(cookie).toContain('HttpOnly');
  });

  it('creates session connected by email when logging in with username', async () => {
    db.user.findFirst.mockResolvedValueOnce({ email: 'tarmogoyf@test.com', username: 'tarmogoyf42', password: 'hashed' });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    db.session.create.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/user/login')
      .send({ identifier: 'tarmogoyf42', password: 'password' });

    expect(res.status).toBe(200);
    expect(db.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: { connect: { email: 'tarmogoyf@test.com' } },
        }),
      })
    );
  });

  it('returns 401 when the password is incorrect', async () => {
    db.user.findFirst.mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', password: 'hashed' });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/user/login')
      .send({ identifier: 'test@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when the user does not exist', async () => {
    db.user.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/user/login')
      .send({ identifier: 'nobody@test.com', password: 'password' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/me
// ---------------------------------------------------------------------------

describe('GET /api/user/me', () => {
  it('returns 200 with user data for a valid session', async () => {
    db.session.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'session-id',
      expires: new Date(Date.now() + 86400000),
      user: { username: 'testuser', decks: [] },
    });

    const res = await request(app)
      .get('/api/user/me')
      .set('Cookie', 'scroll-rack-session=session-id');

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.expires).toBeUndefined(); // not leaked to client
  });

  it('returns 401 when no cookie is present', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the session is expired', async () => {
    db.session.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'session-id',
      expires: new Date(Date.now() - 86400000), // in the past
      user: { username: 'testuser', decks: [] },
    });

    const res = await request(app)
      .get('/api/user/me')
      .set('Cookie', 'scroll-rack-session=session-id');

    expect(res.status).toBe(401);
  });

  it('returns 401 when the session ID is not found', async () => {
    db.session.findUniqueOrThrow.mockRejectedValueOnce({ code: 'P2025' });

    const res = await request(app)
      .get('/api/user/me')
      .set('Cookie', 'scroll-rack-session=bad-id');

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/profile/:username
// ---------------------------------------------------------------------------

describe('GET /api/user/profile/:username', () => {
  it('returns 200 with profile data', async () => {
    db.user.findFirstOrThrow.mockResolvedValueOnce({
      username: 'testuser',
      email: 'test@test.com',
      name: 'Test',
      createdAt: new Date(),
      decks: [],
    });

    const res = await request(app).get('/api/user/profile/testuser');

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
  });

  it('returns 404 when user is not found', async () => {
    db.user.findFirstOrThrow.mockRejectedValueOnce({ code: 'P2025' });

    const res = await request(app).get('/api/user/profile/nobody');

    expect(res.status).toBe(404);
  });
});
