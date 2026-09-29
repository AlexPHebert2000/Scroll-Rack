import { readFileSync } from 'fs';
import path from 'path';

process.env.DATABASE_URL = readFileSync(
  path.join(process.cwd(), '.jest-mongo-uri'),
  'utf8'
).trim();
