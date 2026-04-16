import axios from 'axios';
import prisma from '../db.js';

const CHUNK_SIZE = 500;
const CONCURRENCY = 4; // chunks processed in parallel — keep low for Neon's pooled connection limit

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
  const rawData: any[] = (await axios.get(data.data[0].download_uri)).data;

  // Project to slim objects immediately so the full Scryfall payloads
  // (prices, legalities, URIs…) can be garbage-collected.
  // Faces are collected separately so they can be bulk-inserted after
  // all parent cards are in the DB.
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
  console.log('Uploading to the database...');

  // ── Cards ──────────────────────────────────────────────────────────────────
  // createMany compiles to a single INSERT … ON CONFLICT DO NOTHING per chunk,
  // replacing the previous pattern of 500 individual upserts per chunk.
  const cardChunks = chunks(cards, CHUNK_SIZE);
  let cardCount = 0;
  for (let i = 0; i < cardChunks.length; i += CONCURRENCY) {
    const results = await Promise.all(
      cardChunks.slice(i, i + CONCURRENCY).map(chunk =>
        prisma.card.createMany({ data: chunk, skipDuplicates: true })
      )
    );
    cardCount += results.reduce((sum, r) => sum + r.count, 0);
    console.log(`Cards: ${Math.min((i + CONCURRENCY) * CHUNK_SIZE, cards.length)} / ${cards.length}`);
  }
  console.log(`Inserted ${cardCount} new cards (${cards.length - cardCount} already existed)`);

  // ── Faces ──────────────────────────────────────────────────────────────────
  // All cards must be committed before faces are inserted (foreign key).
  const faceChunks = chunks(faces, CHUNK_SIZE);
  let faceCount = 0;
  for (let i = 0; i < faceChunks.length; i += CONCURRENCY) {
    const results = await Promise.all(
      faceChunks.slice(i, i + CONCURRENCY).map(chunk =>
        prisma.cardFace.createMany({ data: chunk, skipDuplicates: true })
      )
    );
    faceCount += results.reduce((sum, r) => sum + r.count, 0);
  }
  console.log(`Inserted ${faceCount} new card faces`);

  console.timeEnd('Upload time');
};
