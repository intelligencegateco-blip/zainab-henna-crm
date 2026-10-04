#!/usr/bin/env node
/**
 * Print the demo data (src/data/seed.ts) as JSON, dated around today.
 * Used to load demo data into the server database during setup:
 *   node scripts/seed-json.mjs > seed.json
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { createSeedData } = await server.ssrLoadModule('/src/data/seed.ts');
  process.stdout.write(JSON.stringify(createSeedData(new Date())));
} finally {
  await server.close();
}
