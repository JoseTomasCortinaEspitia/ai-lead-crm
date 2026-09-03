import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp, type LeadStore } from '../src/app.js';

describe('POST /api/leads', () => {
  it('creates a normalized lead', async () => {
    const store: LeadStore = {
      async create(input) {
        return { ...input, id: 'lead-1', status: 'new', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
      },
    };
    const response = await request(createApp(store)).post('/api/leads').send({
      name: '  Ada Lovelace  ', email: 'ADA@EXAMPLE.COM', company: '', source: 'website',
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.location, '/api/leads/lead-1');
    assert.equal(response.body.data.name, 'Ada Lovelace');
    assert.equal(response.body.data.email, 'ada@example.com');
  });

  it('rejects invalid input', async () => {
    const store: LeadStore = { async create() { throw new Error('must not run'); } };
    const response = await request(createApp(store)).post('/api/leads').send({ name: '', email: 'wrong' });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Invalid lead data');
  });

  it('reports duplicate emails', async () => {
    const store: LeadStore = { async create() { throw { code: '23505' }; } };
    const response = await request(createApp(store)).post('/api/leads').send({ name: 'Ada', email: 'ada@example.com' });
    assert.equal(response.status, 409);
  });
});
