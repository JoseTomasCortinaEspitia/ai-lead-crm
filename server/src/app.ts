import cors from 'cors';
import express from 'express';
import { z } from 'zod';

export interface LeadStore {
  create(input: LeadInput): Promise<Lead>;
}

export interface Lead extends LeadInput {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(254),
  company: z.string().trim().max(160).optional().transform(value => value || undefined),
  phone: z.string().trim().max(40).optional().transform(value => value || undefined),
  source: z.string().trim().min(1).max(80).optional().default('manual'),
}).strict();

export type LeadInput = z.infer<typeof leadSchema>;

export function createApp(store: LeadStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/leads', async (request, response, next) => {
    const parsed = leadSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Invalid lead data',
        details: z.flattenError(parsed.error).fieldErrors,
      });
      return;
    }

    try {
      const lead = await store.create(parsed.data);
      response.status(201).location(`/api/leads/${lead.id}`).json({ data: lead });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ error: 'A lead with this email already exists' });
        return;
      }
      next(error);
    }
  });

  app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

