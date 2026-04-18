import axios from 'axios';
import prisma from '../db.js';

const CHUNK_SIZE = 500;
const CONCURRENCY = 4;

type SlimCard = {
  id: string; name: string; imageUrl: string | null;
  typeLine: string | null; cmc: number | null; oracleText: string | null; layout: string | null;
};
type SlimFace = {
  cardId: string; name: string; imageUrl: string | null;
  typeLine: string | null; cmc: number | null; oracleText: string | null; layout: string | null;
};

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async () => {
  console.log('Starting card download... Please Wait');
  console.time('Upload time');

  const { data } = await axios.get('https://api.scryfall.com/bulk-data');
  const bulkEntry = data.data.find((e: any) => e.type === 'default_cards');
  if (!bulkEntry) throw new Error('default_cards bulk entry not found in Scryfall response');

  const rawData: any[] = (await axios.get(bulkEntry.download_uri)).data;

  const cards: SlimCard[] = [];
  const faces: SlimFace[] = [];

  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;

    cards.push({
      id: card.id,
      name: card.name,
      imageUrl: card.image_uris?.normal ?? null,
      typeLine: card.type_line ?? null,
      cmc: card.cmc ?? null,
      oracleText: card.oracle_text ?? null,
      layout: card.layout ?? null,
    });

    for (const face of card.card_faces ?? []) {
      faces.push({
        cardId: card.id,
        name: face.name,
        imageUrl: face.image_uris?.normal ?? null,
        typeLine: face.type_line ?? null,
        cmc: face.cmc ?? null,
        oracleText: face.oracle_text ?? null,
        layout: face.layout ?? null,
      });
    }
  }

  console.log(`Retrieved ${cards.length} cards (${faces.length} faces)`);

  // MongoDB Prisma does not support skipDuplicates — pre-filter to new cards only
  const existingIds = new Set(
    (await prisma.card.findMany({ select: { id: true } })).map(c => c.id)
  );
  const newCards = cards.filter(c => !existingIds.has(c.id));
  const newCardIds = new Set(newCards.map(c => c.id));
  const newFaces = faces.filter(f => newCardIds.has(f.cardId));

  console.log(`${newCards.length} new cards to insert (${cards.length - newCards.length} already exist)`);
  console.log('Uploading to the database...');

  // ── Cards ──────────────────────────────────────────────────────────────────
  const cardChunks = chunks(newCards, CHUNK_SIZE);
  let cardCount = 0;
  for (let i = 0; i < cardChunks.length; i += CONCURRENCY) {
    const results = await Promise.all(
      cardChunks.slice(i, i + CONCURRENCY).map(chunk =>
        prisma.card.createMany({ data: chunk })
      )
    );
    cardCount += results.reduce((sum, r) => sum + r.count, 0);
    console.log(`Cards: ${Math.min((i + CONCURRENCY) * CHUNK_SIZE, newCards.length)} / ${newCards.length}`);
  }
  console.log(`Inserted ${cardCount} new cards`);

  // ── Faces ──────────────────────────────────────────────────────────────────
  const faceChunks = chunks(newFaces, CHUNK_SIZE);
  let faceCount = 0;
  for (let i = 0; i < faceChunks.length; i += CONCURRENCY) {
    const results = await Promise.all(
      faceChunks.slice(i, i + CONCURRENCY).map(chunk =>
        prisma.cardFace.createMany({ data: chunk })
      )
    );
    faceCount += results.reduce((sum, r) => sum + r.count, 0);
  }
  console.log(`Inserted ${faceCount} new card faces`);

  console.timeEnd('Upload time');
};
