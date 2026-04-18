import axios from 'axios';
import prisma from '../db.js';

const CHUNK_SIZE = 500;
const CONCURRENCY = 4;

type SlimCard = {
  id: string; name: string; imageUrl: string | null;
  typeLine: string | null; cmc: number | null; oracleText: string | null;
  layout: string | null; tags: string[];
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

function computeTags(oracleText: string | null, faceTexts: (string | null)[]): string[] {
  const all = [oracleText, ...faceTexts].filter(Boolean).join('\n').toLowerCase();
  const tags: string[] = [];
  if (/add \{/.test(all) || /search.*library.*land/.test(all) || /put.*land.*into play/.test(all)) tags.push('ramp');
  if (/draw a card/.test(all) || /draw \d+ cards/.test(all)) tags.push('draw');
  if (/destroy target/.test(all) || /exile target/.test(all) || /deal \d+ damage to target creature/.test(all)) tags.push('removal');
  return tags;
}

export default async () => {
  console.log('Starting card download... Please Wait');
  console.time('Upload time');

  const { data } = await axios.get('https://api.scryfall.com/bulk-data');
  const bulkEntry = data.data.find((e: any) => e.type === 'default_cards');
  if (!bulkEntry) throw new Error('default_cards bulk entry not found in Scryfall response');

  const rawData: any[] = (await axios.get(bulkEntry.download_uri)).data;

  // Collect face texts per card so we can compute tags before inserting
  const faceTextsByCard = new Map<string, (string | null)[]>();
  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;
    const faceTexts = (card.card_faces ?? []).map((f: any) => f.oracle_text ?? null);
    if (faceTexts.length > 0) faceTextsByCard.set(card.id, faceTexts);
  }

  const cards: SlimCard[] = [];
  const faces: SlimFace[] = [];

  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;

    const oracleText = card.oracle_text ?? null;
    const faceTexts = faceTextsByCard.get(card.id) ?? [];

    cards.push({
      id: card.id,
      name: card.name,
      imageUrl: card.image_uris?.normal ?? null,
      typeLine: card.type_line ?? null,
      cmc: card.cmc ?? null,
      oracleText,
      layout: card.layout ?? null,
      tags: computeTags(oracleText, faceTexts),
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
