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

// $runCommandRaw with ordered:false is MongoDB's native skipDuplicates — skips
// any document that violates a unique index and continues with the rest.
// Returns the number of documents actually inserted.
async function bulkInsert(collection: string, docs: object[], label: string): Promise<number> {
  if (docs.length === 0) return 0;
  const batches = chunks(docs, CHUNK_SIZE);
  let inserted = 0;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (batch) => {
        try {
          const result = await prisma.$runCommandRaw({
            insert: collection,
            documents: batch,
            ordered: false,
          }) as { n: number };
          return result.n ?? 0;
        } catch (e: any) {
          console.error(`  [${label}] chunk error (skipping): ${e.message}`);
          return 0;
        }
      })
    );
    inserted += results.reduce((sum, n) => sum + n, 0);
    console.log(`  ${label}: ${Math.min((i + CONCURRENCY) * CHUNK_SIZE, docs.length)} / ${docs.length}`);
  }
  return inserted;
}

export default async () => {
  console.log('Starting card download... Please Wait');
  console.time('Upload time');

  const { data } = await axios.get('https://api.scryfall.com/bulk-data');
  const bulkEntry = data.data.find((e: any) => e.type === 'default_cards');
  if (!bulkEntry) throw new Error('default_cards bulk entry not found in Scryfall response');

  const rawData: any[] = (await axios.get(bulkEntry.download_uri)).data;

  const cardDocs: object[] = [];
  const faceDocs: object[] = [];

  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;

    // Card documents use _id (MongoDB) instead of id
    const { id, ...rest } = {
      id: card.id,
      name: card.name,
      imageUrl: card.image_uris?.normal ?? null,
      typeLine: card.type_line ?? null,
      cmc: card.cmc ?? null,
      oracleText: card.oracle_text ?? null,
      layout: card.layout ?? null,
    } satisfies SlimCard;
    cardDocs.push({ _id: id, ...rest });

    for (const face of card.card_faces ?? []) {
      // Face documents have no explicit _id — MongoDB auto-generates ObjectId
      faceDocs.push({
        cardId: card.id,
        name: face.name,
        imageUrl: face.image_uris?.normal ?? null,
        typeLine: face.type_line ?? null,
        cmc: face.cmc ?? null,
        oracleText: face.oracle_text ?? null,
        layout: face.layout ?? null,
      } satisfies SlimFace);
    }
  }

  console.log(`Retrieved ${cardDocs.length} cards (${faceDocs.length} faces)`);
  console.log('Uploading to the database...');

  const cardCount = await bulkInsert('Card', cardDocs, 'Cards');
  console.log(`Inserted ${cardCount} new cards (${cardDocs.length - cardCount} already existed)`);

  const faceCount = await bulkInsert('CardFace', faceDocs, 'Faces');
  console.log(`Inserted ${faceCount} new card faces (${faceDocs.length - faceCount} already existed)`);

  console.timeEnd('Upload time');
};
