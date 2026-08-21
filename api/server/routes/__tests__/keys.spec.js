const express = require('express');
const request = require('supertest');

jest.mock('~/models', () => ({
  updateUserKey: jest.fn(),
  deleteUserKey: jest.fn(),
  getUserKeyExpiry: jest.fn(),
  getUserKeyValues: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('~/server/middleware/requireJwtAuth', () => (req, res, next) => next());

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => next(),
}));

describe('Keys Routes', () => {
  let app;
  const { updateUserKey, deleteUserKey, getUserKeyExpiry, getUserKeyValues } = require('~/models');
  const axios = require('axios');

  beforeAll(() => {
    const keysRouter = require('../keys');

    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      req.user = { id: 'test-user-123' };
      next();
    });

    app.use('/api/keys', keysRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('GET /aittco/quota', () => {
    it('returns normalized quota data without exposing the shared key', async () => {
      getUserKeyValues.mockResolvedValue({ apiKey: 'sk-super-secret' });
      axios.get.mockResolvedValue({ data: { total: 1000, used: 250 } });

      const response = await request(app).get('/api/keys/aittco/quota');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ total: 1000, used: 250, remaining: 750, percentage: 25 });
      expect(JSON.stringify(response.body)).not.toContain('sk-super-secret');
      expect(getUserKeyValues).toHaveBeenCalledWith({ userId: 'test-user-123', name: 'aittco_shared' });
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/key/balance'),
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-super-secret' } }),
      );
    });

    it('returns 404 when the user has no shared key', async () => {
      getUserKeyValues.mockRejectedValue(new Error('no user key'));

      const response = await request(app).get('/api/keys/aittco/quota');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Aittco API key is not configured.' });
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('caches quota responses for 60 seconds per user', async () => {
      jest.useFakeTimers();
      getUserKeyValues.mockResolvedValue({ apiKey: 'sk-cache-key' });
      axios.get.mockResolvedValue({ data: { balance: 42 } });

      await request(app).get('/api/keys/aittco/quota');
      await request(app).get('/api/keys/aittco/quota');
      expect(axios.get).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60001);
      await request(app).get('/api/keys/aittco/quota');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('PUT /', () => {
    it('should update a user key with the authenticated user ID', async () => {
      updateUserKey.mockResolvedValue({});

      const response = await request(app)
        .put('/api/keys')
        .send({ name: 'openAI', value: 'sk-test-key-123', expiresAt: '2026-12-31' });

      expect(response.status).toBe(201);
      expect(updateUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'openAI',
        value: 'sk-test-key-123',
        expiresAt: '2026-12-31',
      });
      expect(updateUserKey).toHaveBeenCalledTimes(1);
    });

    it('should not allow userId override via request body (IDOR prevention)', async () => {
      updateUserKey.mockResolvedValue({});

      const response = await request(app).put('/api/keys').send({
        userId: 'attacker-injected-id',
        name: 'openAI',
        value: 'sk-attacker-key',
      });

      expect(response.status).toBe(201);
      expect(updateUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'openAI',
        value: 'sk-attacker-key',
        expiresAt: undefined,
      });
    });

    it('should ignore extraneous fields from request body', async () => {
      updateUserKey.mockResolvedValue({});

      const response = await request(app).put('/api/keys').send({
        name: 'openAI',
        value: 'sk-test-key',
        expiresAt: '2026-12-31',
        _id: 'injected-mongo-id',
        __v: 99,
        extra: 'should-be-ignored',
      });

      expect(response.status).toBe(201);
      expect(updateUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'openAI',
        value: 'sk-test-key',
        expiresAt: '2026-12-31',
      });
    });

    it('should handle missing optional fields', async () => {
      updateUserKey.mockResolvedValue({});

      const response = await request(app)
        .put('/api/keys')
        .send({ name: 'anthropic', value: 'sk-ant-key' });

      expect(response.status).toBe(201);
      expect(updateUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'anthropic',
        value: 'sk-ant-key',
        expiresAt: undefined,
      });
    });

    it('should return 400 when request body is null', async () => {
      const response = await request(app)
        .put('/api/keys')
        .set('Content-Type', 'application/json')
        .send('null');

      expect(response.status).toBe(400);
      expect(updateUserKey).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:name', () => {
    it('should delete a user key by name', async () => {
      deleteUserKey.mockResolvedValue({});

      const response = await request(app).delete('/api/keys/openAI');

      expect(response.status).toBe(204);
      expect(deleteUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'openAI',
      });
      expect(deleteUserKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /', () => {
    it('should delete all keys when all=true', async () => {
      deleteUserKey.mockResolvedValue({});

      const response = await request(app).delete('/api/keys?all=true');

      expect(response.status).toBe(204);
      expect(deleteUserKey).toHaveBeenCalledWith({
        userId: 'test-user-123',
        all: true,
      });
    });

    it('should return 400 when all query param is not true', async () => {
      const response = await request(app).delete('/api/keys');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Specify either all=true to delete.' });
      expect(deleteUserKey).not.toHaveBeenCalled();
    });
  });

  describe('GET /', () => {
    it('should return key expiry for a given key name', async () => {
      const mockExpiry = { expiresAt: '2026-12-31' };
      getUserKeyExpiry.mockResolvedValue(mockExpiry);

      const response = await request(app).get('/api/keys?name=openAI');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockExpiry);
      expect(getUserKeyExpiry).toHaveBeenCalledWith({
        userId: 'test-user-123',
        name: 'openAI',
      });
    });
  });
});
