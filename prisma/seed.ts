import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed IDs so the script is idempotent — re-running wipes and recreates seed data.
const USER_EMAIL = 'seed@scrollrack.dev';
const DECK_ID    = 'seed-deck-1';
const BRANCH_ID  = 'seed-branch1';
const DLIST_ID   = 'seed-dlist-1';
const COMMIT_1   = 'seed-cmt-1';  // 10 chars — matches @db.Char(10)
const COMMIT_2   = 'seed-cmt-2';
const COMMIT_3   = 'seed-cmt-3';
const COMMIT_4   = 'seed-cmt-4';

const CARDS = [
  { id: 'seed-bolt',   name: 'Lightning Bolt' },
  { id: 'seed-ritual', name: 'Dark Ritual'    },
  { id: 'seed-lotus',  name: 'Black Lotus'    },
  { id: 'seed-delta',  name: 'Polluted Delta' },
  { id: 'seed-tarn',   name: 'Scalding Tarn'  },
];

async function main() {
  console.log('Seeding database…');

  // ── Cards ──────────────────────────────────────────────────────────────────
  for (const card of CARDS) {
    await prisma.card.upsert({ where: { id: card.id }, update: {}, create: card });
  }
  console.log('  ✓ Cards');

  // ── User ───────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {},
    create: {
      email: USER_EMAIL,
      username: 'seeduser',
      name: 'Seed User',
      password: passwordHash,
    },
  });
  console.log('  ✓ User  (seed@scrollrack.dev / password123)');

  // ── Wipe previous seed deck (cascades to branches, commits, changes) ───────
  const existingBranches = await prisma.branch.findMany({
    where: { deckId: DECK_ID },
    select: { decklistId: true },
  });
  await prisma.deck.deleteMany({ where: { id: DECK_ID } });
  // Decklist FK lives on Branch, so it isn't cascade-deleted — clean up manually.
  if (existingBranches.length) {
    await prisma.decklist.deleteMany({
      where: { id: { in: existingBranches.map((b) => b.decklistId) } },
    });
  }

  // ── Deck + branch + empty decklist ────────────────────────────────────────
  await prisma.deck.create({
    data: {
      id: DECK_ID,
      name: 'Control Spells',
      description: 'A seeded example deck with a short commit history.',
      user: { connect: { email: USER_EMAIL } },
      branches: {
        create: {
          id: BRANCH_ID,
          name: 'main',
          decklist: { create: { id: DLIST_ID } },
        },
      },
    },
  });

  // ── Commits ────────────────────────────────────────────────────────────────
  // 1. INIT — empty deck
  await prisma.commit.create({
    data: { id: COMMIT_1, description: 'INIT', branch: { connect: { id: BRANCH_ID } } },
  });

  // 2. Add core spells
  await prisma.commit.create({
    data: {
      id: COMMIT_2,
      description: 'Add core spells',
      branch: { connect: { id: BRANCH_ID } },
      changes: {
        create: [
          { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-bolt'   } } },
          { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-ritual' } } },
          { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-lotus'  } } },
        ],
      },
    },
  });

  // 3. Add fetchlands
  await prisma.commit.create({
    data: {
      id: COMMIT_3,
      description: 'Add fetchlands',
      branch: { connect: { id: BRANCH_ID } },
      changes: {
        create: [
          { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-delta' } } },
          { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-tarn'  } } },
        ],
      },
    },
  });

  // 4. Remove Black Lotus
  await prisma.commit.create({
    data: {
      id: COMMIT_4,
      description: 'Remove Black Lotus',
      branch: { connect: { id: BRANCH_ID } },
      changes: {
        create: [
          { action: 'REMOVE', board: 'MAIN', card: { connect: { id: 'seed-lotus' } } },
        ],
      },
    },
  });

  // ── Finalise: set decklist state and HEAD pointer ──────────────────────────
  // Final state after replaying commits: bolt, ritual, delta, tarn (lotus removed)
  await prisma.decklist.update({
    where: { id: DLIST_ID },
    data: {
      mainDeck: {
        connect: [
          { id: 'seed-bolt'   },
          { id: 'seed-ritual' },
          { id: 'seed-delta'  },
          { id: 'seed-tarn'   },
        ],
      },
    },
  });

  await prisma.branch.update({
    where: { id: BRANCH_ID },
    data: { headCommitId: COMMIT_4 },
  });

  console.log('  ✓ Deck "Control Spells" with 4 commits');
  console.log('\nSeed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
