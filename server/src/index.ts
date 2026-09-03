import 'dotenv/config';
import { createApp } from './app.js';
import { pool } from './db.js';
import { PostgresLeadStore } from './lead-store.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp(new PostgresLeadStore(pool));

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

