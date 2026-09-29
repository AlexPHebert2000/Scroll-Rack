import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed IDs so the script is idempotent — re-running wipes and recreates seed data.
const USER_EMAIL = 'seed@scrollrack.dev';

// ── Fake-card deck IDs ────────────────────────────────────────────────────────
const DECK_ID   = 'seed-deck-1';
const BRANCH_ID = 'seed-branch1';
const DLIST_ID  = 'seed-dlist-1';
const COMMIT_1  = 'seed-cmt-1';   // @db.Char(10) — must be exactly 10 chars
const COMMIT_2  = 'seed-cmt-2';
const COMMIT_3  = 'seed-cmt-3';
const COMMIT_4  = 'seed-cmt-4';

const FAKE_CARDS = [
  { id: 'seed-bolt',   name: 'Lightning Bolt' },
  { id: 'seed-ritual', name: 'Dark Ritual'    },
  { id: 'seed-lotus',  name: 'Black Lotus'    },
  { id: 'seed-delta',  name: 'Polluted Delta' },
  { id: 'seed-tarn',   name: 'Scalding Tarn'  },
];

// ── Real-card deck IDs ────────────────────────────────────────────────────────
const REAL_DECK_ID    = 'real-deck-01';
const REAL_MAIN_BR    = 'real-main-br';
const REAL_BUDG_BR    = 'real-budg-br';
const REAL_DLIST_MAIN = 'real-dlist-m';
const REAL_DLIST_BUDG = 'real-dlist-b';
const RCMT1           = 'rcard-cm01';  // INIT
const RCMT2           = 'rcard-cm02';  // batch 1
const RCMT3           = 'rcard-cm03';  // batch 2
const RCMT4           = 'rcard-cm04';  // batch 3 (main only)
const RCMT_B1         = 'rcard-cm10';  // budget seed
const RCMT_B2         = 'rcard-cm11';  // budget trim

// Cards to look up from the Scryfall data — well-known, always present in the bulk export
const WANTED_CARDS = [
  'Lightning Bolt', 'Counterspell', 'Brainstorm', 'Ponder', 'Opt',
  'Snapcaster Mage', 'Spellstutter Sprite',
  'Steam Vents', 'Island', 'Mountain',
];

// ─────────────────────────────────────────────────────────────────────────────

async function wipeDeck(deckId: string) {
  const branches = await prisma.branch.findMany({
    where: { deckId },
    select: { decklistId: true },
  });
  await prisma.deck.deleteMany({ where: { id: deckId } });
  // Decklist FK lives on Branch so it is not cascade-deleted — clean up manually.
  if (branches.length) {
    await prisma.decklist.deleteMany({
      where: { id: { in: branches.map(b => b.decklistId) } },
    });
  }
}

function describeAdds(cards: { name: string }[]): string {
  if (cards.length <= 3) return `Add ${cards.map(c => c.name).join(', ')}`;
  return `Add ${cards.slice(0, 3).map(c => c.name).join(', ')} and ${cards.length - 3} more`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database…\n');

  // ── Fake cards ──────────────────────────────────────────────────────────────
  for (const card of FAKE_CARDS) {
    await prisma.card.upsert({ where: { id: card.id }, update: {}, create: card });
  }
  console.log('  ✓ Fake cards');

  // ── User ───────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {},
    create: { email: USER_EMAIL, username: 'seeduser', name: 'Seed User', password: passwordHash },
  });
  console.log('  ✓ User  (seed@scrollrack.dev / password123)');

  // ── Deck 1: fake cards, single branch ──────────────────────────────────────
  await wipeDeck(DECK_ID);

  await prisma.deck.create({
    data: {
      id: DECK_ID,
      name: 'Control Spells',
      description: 'A seeded example deck with a short commit history.',
      user: { connect: { email: USER_EMAIL } },
      branches: { create: { id: BRANCH_ID, name: 'main', decklist: { create: { id: DLIST_ID } } } },
    },
  });

  await prisma.commit.create({
    data: { id: COMMIT_1, description: 'INIT', branch: { connect: { id: BRANCH_ID } } },
  });
  await prisma.commit.create({
    data: {
      id: COMMIT_2, description: 'Add core spells',
      branch: { connect: { id: BRANCH_ID } },
      changes: { create: [
        { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-bolt'   } } },
        { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-ritual' } } },
        { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-lotus'  } } },
      ]},
    },
  });
  await prisma.commit.create({
    data: {
      id: COMMIT_3, description: 'Add fetchlands',
      branch: { connect: { id: BRANCH_ID } },
      changes: { create: [
        { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-delta' } } },
        { action: 'ADD', board: 'MAIN', card: { connect: { id: 'seed-tarn'  } } },
      ]},
    },
  });
  await prisma.commit.create({
    data: {
      id: COMMIT_4, description: 'Remove Black Lotus',
      branch: { connect: { id: BRANCH_ID } },
      changes: { create: [
        { action: 'REMOVE', board: 'MAIN', card: { connect: { id: 'seed-lotus' } } },
      ]},
    },
  });

  await prisma.decklist.update({
    where: { id: DLIST_ID },
    data: { mainDeck: { connect: [
      { id: 'seed-bolt' }, { id: 'seed-ritual' }, { id: 'seed-delta' }, { id: 'seed-tarn' },
    ]}},
  });
  await prisma.branch.update({ where: { id: BRANCH_ID }, data: { headCommitId: COMMIT_4 } });

  console.log('  ✓ Deck "Control Spells" — 4 commits, 1 branch');

  // ── Deck 2: real Scryfall cards, two branches ───────────────────────────────
  const found = await prisma.card.findMany({
    where: { name: { in: WANTED_CARDS } },
    distinct: ['name'],
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (found.length < 6) {
    console.log(`\n  ⚠ Skipping real-cards deck — only ${found.length}/${WANTED_CARDS.length} target cards found.`);
    console.log('    Run POST /api/download to import Scryfall data, then re-seed.');
  } else {
    await wipeDeck(REAL_DECK_ID);

    // Split found cards into three batches for three successive commits
    const third  = Math.ceil(found.length / 3);
    const batch1 = found.slice(0, third);
    const batch2 = found.slice(third, third * 2);
    const batch3 = found.slice(third * 2);

    // ── Main branch ────────────────────────────────────────────────────────
    await prisma.deck.create({
      data: {
        id: REAL_DECK_ID,
        name: 'Izzet Spells',
        description: 'A real-cards deck seeded from Scryfall data, with two branches.',
        user: { connect: { email: USER_EMAIL } },
        branches: { create: { id: REAL_MAIN_BR, name: 'main', decklist: { create: { id: REAL_DLIST_MAIN } } } },
      },
    });

    const commit2Desc = describeAdds(batch1);
    const commit3Desc = describeAdds(batch2);
    const commit4Desc = describeAdds(batch3);

    await prisma.commit.create({
      data: { id: RCMT1, description: 'INIT', branch: { connect: { id: REAL_MAIN_BR } } },
    });
    await prisma.commit.create({
      data: {
        id: RCMT2, description: commit2Desc,
        branch: { connect: { id: REAL_MAIN_BR } },
        changes: { create: batch1.map(c => ({ action: 'ADD', board: 'MAIN', card: { connect: { id: c.id } } })) },
      },
    });
    await prisma.commit.create({
      data: {
        id: RCMT3, description: commit3Desc,
        branch: { connect: { id: REAL_MAIN_BR } },
        changes: { create: batch2.map(c => ({ action: 'ADD', board: 'MAIN', card: { connect: { id: c.id } } })) },
      },
    });
    await prisma.commit.create({
      data: {
        id: RCMT4, description: commit4Desc,
        branch: { connect: { id: REAL_MAIN_BR } },
        changes: { create: batch3.map(c => ({ action: 'ADD', board: 'MAIN', card: { connect: { id: c.id } } })) },
      },
    });

    await prisma.decklist.update({
      where: { id: REAL_DLIST_MAIN },
      data: { mainDeck: { connect: found.map(c => ({ id: c.id })) } },
    });
    await prisma.branch.update({ where: { id: REAL_MAIN_BR }, data: { headCommitId: RCMT4 } });

    // ── Budget branch (conceptually forked after commit 3) ─────────────────
    // Starts with batch1 + batch2, then removes the first batch1 card as a
    // "budget trim" to demonstrate a divergent commit on the branch.
    await prisma.branch.create({
      data: {
        id: REAL_BUDG_BR,
        name: 'budget',
        deck: { connect: { id: REAL_DECK_ID } },
        decklist: { create: { id: REAL_DLIST_BUDG } },
      },
    });

    const budgetSeed = [...batch1, ...batch2];
    const trimmed    = batch1[0];

    await prisma.commit.create({
      data: {
        id: RCMT_B1,
        description: `Branched from "${commit3Desc}"`,
        branch: { connect: { id: REAL_BUDG_BR } },
        changes: { create: budgetSeed.map(c => ({ action: 'ADD', board: 'MAIN', card: { connect: { id: c.id } } })) },
      },
    });
    await prisma.commit.create({
      data: {
        id: RCMT_B2,
        description: `Remove ${trimmed.name} (too expensive)`,
        branch: { connect: { id: REAL_BUDG_BR } },
        changes: { create: [{ action: 'REMOVE', board: 'MAIN', card: { connect: { id: trimmed.id } } }] },
      },
    });

    const budgetFinal = budgetSeed.filter(c => c.id !== trimmed.id);
    await prisma.decklist.update({
      where: { id: REAL_DLIST_BUDG },
      data: { mainDeck: { connect: budgetFinal.map(c => ({ id: c.id })) } },
    });
    await prisma.branch.update({ where: { id: REAL_BUDG_BR }, data: { headCommitId: RCMT_B2 } });

    console.log(`  ✓ Deck "Izzet Spells" — ${found.length} real cards, 4 commits on main, 2 commits on budget`);
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
