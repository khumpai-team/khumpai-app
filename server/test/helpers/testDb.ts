import { execSync } from 'node:child_process';
// DB is already running on 5433 (see server/.env). Ensure migrations + seed are applied (idempotent).
export function prepareTestDb() {
  execSync('npm run db:migrate', { stdio: 'inherit' });
  execSync('npm run db:seed', { stdio: 'inherit' });
}
