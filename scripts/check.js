import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.js';
import { makeServer } from '../src/app.js';

for (const directory of ['src','public','scripts','test']) {
  const base = new URL('../'+directory+'/',import.meta.url);
  for (const name of readdirSync(base).filter(name => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,base))],{stdio:'inherit'});
    if (result.status !== 0) process.exit(1);
  }
}
const db = openDb(':memory:');
makeServer(db,{siteUrl:'https://proxmarketing.uz'}).close();
db.close();
console.log('Source syntax, startup imports and database migration verified. Server-side code needs no bundle.');
