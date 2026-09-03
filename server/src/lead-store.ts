import type { Pool } from 'pg';
import type { Lead, LeadInput, LeadStore } from './app.js';

export class PostgresLeadStore implements LeadStore {
  constructor(private readonly pool: Pool) {}

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

