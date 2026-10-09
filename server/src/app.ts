import cors from 'cors';
import express from 'express';
import { z } from 'zod';

export interface LeadStore {
  create(input: LeadInput): Promise<Lead>;
  list(): Promise<Lead[]>;
  get(id: string): Promise<Lead | undefined>;
  update(id: string, input: LeadUpdate): Promise<Lead | undefined>;
  delete(id: string): Promise<boolean>;
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

const updateSchema = leadSchema.partial().extend({
  source: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
export type LeadUpdate = z.infer<typeof updateSchema>;

export function createApp(store: LeadStore) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.get('/api/leads', async (_request, response) => {
    response.json({ data: await store.list() });
  });

  app.use('/api/leads/:id', (request, response, next) => {
    if (!z.uuid().safeParse(request.params.id).success) {
      response.status(400).json({ error: 'Invalid lead id' });
      return;
    }
    next();
  });

  app.get('/api/leads/:id', async (request, response) => {
    const lead = await store.get(request.params.id);
    if (!lead) {
      response.status(404).json({ error: 'Lead not found' });
      return;
    }
    response.json({ data: lead });
  });

  app.patch('/api/leads/:id', async (request, response, next) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid lead data', details: z.flattenError(parsed.error) });
      return;
    }
    try {
      const lead = await store.update(request.params.id, parsed.data);
      if (!lead) {
        response.status(404).json({ error: 'Lead not found' });
        return;
      }
      response.json({ data: lead });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ error: 'A lead with this email already exists' });
        return;
      }
      next(error);
    }
  });

  app.delete('/api/leads/:id', async (request, response) => {
    if (!await store.delete(request.params.id)) {
      response.status(404).json({ error: 'Lead not found' });
      return;
    }
    response.status(204).end();
  });

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

  /*app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: 'Internal server error' });
  });*/

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('SERVER ERROR:', error);

  response.status(500).json({
    error: 'Internal server error'
  });
  
});

  return app;
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

