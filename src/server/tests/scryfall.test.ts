import request from 'supertest';
import axios from 'axios';
import app from '../app';
import prisma from '../db';

jest.mock('axios');
jest.mock('../db', () => ({
  __esModule: true,
  default: {
    card: {
      findMany: jest.fn(),
    },
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const db = prisma as { card: { findMany: jest.Mock } };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/scryfall/search', () => {
  it('returns matching cards from the local database', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ id: 'card-1' }, { id: 'card-2' }] },
    });
    db.card.findMany.mockResolvedValueOnce([
      { id: 'card-1', name: 'Black Lotus', imageUrl: null, faces: [] },
    ]);

    const res = await request(app).get('/api/scryfall/search?qString=lotus');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Black Lotus');
  });

  it('URL-encodes the query string before forwarding to Scryfall (regression)', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });
    db.card.findMany.mockResolvedValueOnce([]);

    await request(app).get('/api/scryfall/search?qString=t%3Acreature+c%3Ared');

    const calledUrl: string = mockedAxios.get.mock.calls[0][0];
    // The raw query value is "t:creature c:red" — must be percent-encoded in the URL
    expect(calledUrl).not.toContain('t:creature');
    expect(calledUrl).toContain(encodeURIComponent('t:creature c:red'));
  });

  it('returns 400 when qString query param is missing', async () => {
    const res = await request(app).get('/api/scryfall/search');
    expect(res.status).toBe(400);
  });

  it('returns 500 when the Scryfall API call fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app).get('/api/scryfall/search?qString=lotus');

    expect(res.status).toBe(500);
  });
});
