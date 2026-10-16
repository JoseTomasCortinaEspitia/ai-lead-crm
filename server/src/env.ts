import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// The shared root configuration takes precedence over the legacy server file.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
config({ quiet: true });
