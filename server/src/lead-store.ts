import type { Pool } from 'pg';
import type { Lead, LeadInput, LeadStore, LeadUpdate } from './app.js';

export class PostgresLeadStore implements LeadStore {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Lead[]> {
    const result = await this.pool.query<LeadRow>('SELECT * FROM leads ORDER BY created_at DESC, id DESC');
    return result.rows.map(toLead);
  }

  async get(id: string): Promise<Lead | undefined> {
    const result = await this.pool.query<LeadRow>('SELECT * FROM leads WHERE id = $1', [id]);
    return result.rows[0] ? toLead(result.rows[0]) : undefined;
  }

  async update(id: string, input: LeadUpdate): Promise<Lead | undefined> {
    const fields = ['name', 'email', 'company', 'phone', 'source', 'status'] as const;
    const selected = fields.filter(field => Object.hasOwn(input, field));
    if (selected.length === 0) return this.get(id);
    const values = selected.map(field => input[field] ?? null);
    const assignments = selected.map((field, index) => `${field} = $${index + 1}`);
    const result = await this.pool.query<LeadRow>(
      `UPDATE leads SET ${assignments.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id],
    );
    return result.rows[0] ? toLead(result.rows[0]) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM leads WHERE id = $1', [id]);
    return result.rowCount === 1;
  }

  async create(input: LeadInput): Promise<Lead> {
    const result = await this.pool.query<LeadRow>(
      `INSERT INTO leads (name, email, company, phone, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, company, phone, source, status, created_at, updated_at`,
      [input.name, input.email, input.company ?? null, input.phone ?? null, input.source],
    );
    return toLead(result.rows[0]);
  }
}

interface LeadRow {
  id: string; name: string; email: string; company: string | null; phone: string | null;
  source: string; status: string; created_at: Date; updated_at: Date;
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company ?? undefined,
    phone: row.phone ?? undefined,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

