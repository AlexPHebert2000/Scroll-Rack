import axios from 'axios';
import prisma from '../db.js';

const CHUNK_SIZE = 500;
const CONCURRENCY = 4;

type SlimCard = {
  id: string; name: string; imageUrl: string | null; artCropUrl: string | null;
  typeLine: string | null; cmc: number | null; oracleText: string | null; layout: string | null;
};
type SlimFace = {
  cardId: string; name: string; imageUrl: string | null; artCropUrl: string | null;
  typeLine: string | null; cmc: number | null; oracleText: string | null; layout: string | null;
};

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bulk upsert using MongoDB's native update command with upsert:true.
// Existing documents are updated in-place; new ones are inserted.
// filterField: the field(s) used to match existing docs (e.g. '_id' for cards).
async function bulkUpsert(collection: string, docs: Record<string, unknown>[], filterFields: string[], label: string): Promise<void> {
  if (docs.length === 0) return;
  const batches = chunks(docs, CHUNK_SIZE);
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (batch) => {
        const updates = batch.map(doc => {
          const filter: Record<string, unknown> = {};
          for (const f of filterFields) filter[f] = doc[f];
          const { ...fields } = doc;
          // Remove filter fields from $set to avoid immutable field errors on _id
          for (const f of filterFields) if (f === '_id') delete fields[f];
          return { q: filter, u: { $set: fields }, upsert: true };
        });
        try {
          await prisma.$runCommandRaw({ update: collection, updates, ordered: false });
        } catch (e: any) {
          console.error(`  [${label}] chunk error: ${e.message}`);
        }
      })
    );
    console.log(`  ${label}: ${Math.min((i + CONCURRENCY) * CHUNK_SIZE, docs.length)} / ${docs.length}`);
  }
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
      artCropUrl: card.image_uris?.art_crop ?? null,
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
        artCropUrl: face.image_uris?.art_crop ?? null,
        typeLine: face.type_line ?? null,
        cmc: face.cmc ?? null,
        oracleText: face.oracle_text ?? null,
        layout: face.layout ?? null,
      } satisfies SlimFace);
    }
  }

  console.log(`Retrieved ${cardDocs.length} cards (${faceDocs.length} faces)`);
  console.log('Uploading to the database...');

  await bulkUpsert('Card', cardDocs as Record<string, unknown>[], ['_id'], 'Cards');
  console.log(`Upserted ${cardDocs.length} cards`);

  await bulkUpsert('CardFace', faceDocs as Record<string, unknown>[], ['cardId', 'name'], 'Faces');
  console.log(`Upserted ${faceDocs.length} card faces`);

  console.timeEnd('Upload time');
};
