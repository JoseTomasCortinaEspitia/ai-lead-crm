import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp, type LeadStore } from '../src/app.js';
import type { Pool } from 'pg';
import { PostgresLeadStore } from '../src/lead-store.js';

function makeStore(overrides: Partial<LeadStore> = {}): LeadStore {
  return {
    async create() { throw new Error('Unexpected create'); },
    async list() { return []; },
    async get() { return undefined; },
    async update() { return undefined; },
    async delete() { return false; },
    ...overrides,
  };
}

const id = '550e8400-e29b-41d4-a716-446655440000';
const lead = { id, name: 'Ada', email: 'ada@example.com', source: 'website', status: 'new', createdAt: new Date(), updatedAt: new Date() };

describe('Lead CRUD', () => {
  it('persists closed through the PostgreSQL store and reads it back', async () => {
    const row = { ...lead, company: null, phone: null, created_at: lead.createdAt, updated_at: lead.updatedAt };
    const pool = { async query(sql: string, values: unknown[]) {
      if (sql.startsWith('UPDATE')) {
        assert.equal(sql, 'UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 RETURNING *');
        assert.deepEqual(values, ['closed', id]);
        row.status = String(values[0]);
      } else {
        assert.equal(sql, 'SELECT * FROM leads WHERE id = $1');
        assert.deepEqual(values, [id]);
      }
      return { rows: [row] };
    } } as unknown as Pool;
    const app = createApp(new PostgresLeadStore(pool));
    const response = await request(app).patch(`/api/leads/${id}`).send({ status: 'closed' });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'closed');
    const reloaded = await request(app).get(`/api/leads/${id}`);
    assert.equal(reloaded.body.data.status, 'closed');
    assert.equal(reloaded.body.data.email, lead.email);
  });

  it('lists leads and returns an empty collection', async () => {
    const response = await request(createApp(makeStore({ async list() { return [lead]; } }))).get('/api/leads');
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].id, id);
    const empty = await request(createApp(makeStore())).get('/api/leads');
    assert.deepEqual(empty.body, { data: [] });
  });

  it('gets a lead by id', async () => {
    const response = await request(createApp(makeStore({ async get(value) { assert.equal(value, id); return lead; } }))).get(`/api/leads/${id}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, id);
  });

  it('normalizes partial updates without inserting defaults', async () => {
    const response = await request(createApp(makeStore({ async update(value, input) {
      assert.equal(value, id);
      assert.deepEqual(input, { name: 'Grace', company: undefined, status: 'qualified' });
      return { ...lead, ...input };
    } }))).patch(`/api/leads/${id}`).send({ name: ' Grace ', company: '', status: 'qualified' });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.source, 'website');
  });

  it('rejects empty, unknown, and invalid updates', async () => {
    for (const body of [{}, { id }, { name: '' }, { email: 'wrong' }, { status: 'invalid' }, { source: '' }]) {
      const response = await request(createApp(makeStore({ async update() { throw new Error('must not run'); } }))).patch(`/api/leads/${id}`).send(body);
      assert.equal(response.status, 400);
    }
  });

  it('reports duplicate emails on updates', async () => {
    const response = await request(createApp(makeStore({ async update() { throw { code: '23505' }; } }))).patch(`/api/leads/${id}`).send({ email: 'ada@example.com' });
    assert.equal(response.status, 409);
  });

  it('deletes a lead with no response body', async () => {
    const response = await request(createApp(makeStore({ async delete(value) { assert.equal(value, id); return true; } }))).delete(`/api/leads/${id}`);
    assert.equal(response.status, 204);
    assert.equal(response.text, '');
  });

  for (const method of ['get', 'patch', 'delete'] as const) {
    it(`returns 404 for missing leads on ${method}`, async () => {
      const response = await request(createApp(makeStore()))[method](`/api/leads/${id}`).send({ name: 'Grace' });
      assert.equal(response.status, 404);
    });
    it(`rejects invalid ids on ${method}`, async () => {
      const response = await request(createApp(makeStore()))[method]('/api/leads/invalid').send({ name: 'Grace' });
      assert.equal(response.status, 400);
    });
  }
});

describe('POST /api/leads', () => {
  it('creates a normalized lead', async () => {
    const store = makeStore({
      async create(input) {
        return { ...input, id: 'lead-1', status: 'new', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
      },
    });
    const response = await request(createApp(store)).post('/api/leads').send({
      name: '  Ada Lovelace  ', email: 'ADA@EXAMPLE.COM', company: '', source: 'website',
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.location, '/api/leads/lead-1');
    assert.equal(response.body.data.name, 'Ada Lovelace');
    assert.equal(response.body.data.email, 'ada@example.com');
  });

  it('rejects invalid input', async () => {
    const store = makeStore({ async create() { throw new Error('must not run'); } });
    const response = await request(createApp(store)).post('/api/leads').send({ name: '', email: 'wrong' });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Invalid lead data');
  });

  it('reports duplicate emails', async () => {
    const store = makeStore({ async create() { throw { code: '23505' }; } });
    const response = await request(createApp(store)).post('/api/leads').send({ name: 'Ada', email: 'ada@example.com' });
    assert.equal(response.status, 409);
  });
});
