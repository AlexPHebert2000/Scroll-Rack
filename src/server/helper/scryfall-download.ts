import axios from 'axios';
import prisma from '../db.js';

const CHUNK_SIZE = 500;
const CONCURRENCY = 4;

type SlimCard = {
  id: string; name: string; oracleId: string | null;
  typeLine: string | null; cmc: number | null; manaCost: string | null;
  oracleText: string | null; layout: string | null;
};
type SlimFace = {
  cardId: string; name: string; order: number;
  typeLine: string | null; cmc: number | null; oracleText: string | null; layout: string | null;
};
type SlimArt = {
  id: string; oracleId: string; name: string;
  imageUrl: string | null; artCropUrl: string | null;
  set: string | null; setName: string | null; artist: string | null;
};
type SlimArtFace = {
  cardArtId: string; name: string; order: number;
  imageUrl: string | null; artCropUrl: string | null;
};

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bulk upsert using MongoDB's native update command with upsert:true.
// Existing documents are updated in-place; new ones are inserted.
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

// Default cards download — populates Card, CardFace, and a CardArt entry for the default printing.
// The CardArt for the default printing shares the same Scryfall UUID as the Card record.
export default async () => {
  console.log('Starting card download... Please Wait');
  console.time('Upload time');

  const { data } = await axios.get('https://api.scryfall.com/bulk-data');
  const bulkEntry = data.data.find((e: any) => e.type === 'default_cards');
  if (!bulkEntry) throw new Error('default_cards bulk entry not found in Scryfall response');

  const rawData: any[] = (await axios.get(bulkEntry.download_uri)).data;

  const cardDocs: object[] = [];
  const faceDocs: object[] = [];
  const artDocs: object[] = [];
  const artFaceDocs: object[] = [];

  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;

    const { id, ...rest } = {
      id: card.id,
      name: card.name,
      oracleId: card.oracle_id ?? null,
      typeLine: card.type_line ?? null,
      cmc: card.cmc ?? null,
      manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
      oracleText: card.oracle_text ?? null,
      layout: card.layout ?? null,
    } satisfies SlimCard;
    cardDocs.push({ _id: id, ...rest });

    for (let fi = 0; fi < (card.card_faces ?? []).length; fi++) {
      const face = card.card_faces[fi];
      faceDocs.push({
        cardId: card.id,
        name: face.name,
        order: fi,
        typeLine: face.type_line ?? null,
        cmc: face.cmc ?? null,
        oracleText: face.oracle_text ?? null,
        layout: face.layout ?? null,
      } satisfies SlimFace);
    }

    if (!card.oracle_id) continue;

    // DFCs may lack top-level image_uris — fall back to first face
    const topImageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    const topArtCropUrl = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null;

    const { id: artId, ...artRest } = {
      id: card.id,
      oracleId: card.oracle_id,
      name: card.name,
      imageUrl: topImageUrl,
      artCropUrl: topArtCropUrl,
      set: card.set ?? null,
      setName: card.set_name ?? null,
      artist: card.artist ?? null,
    } satisfies SlimArt;
    artDocs.push({ _id: artId, ...artRest });

    for (let fi = 0; fi < (card.card_faces ?? []).length; fi++) {
      const face = card.card_faces[fi];
      artFaceDocs.push({
        cardArtId: card.id,
        name: face.name,
        order: fi,
        imageUrl: face.image_uris?.normal ?? null,
        artCropUrl: face.image_uris?.art_crop ?? null,
      } satisfies SlimArtFace);
    }
  }

  console.log(`Retrieved ${cardDocs.length} cards (${faceDocs.length} faces, ${artDocs.length} default arts)`);
  console.log('Uploading to the database...');

  await bulkUpsert('Card', cardDocs as Record<string, unknown>[], ['_id'], 'Cards');
  await bulkUpsert('CardFace', faceDocs as Record<string, unknown>[], ['cardId', 'name'], 'Faces');
  await bulkUpsert('CardArt', artDocs as Record<string, unknown>[], ['_id'], 'DefaultArts');
  await bulkUpsert('CardArtFace', artFaceDocs as Record<string, unknown>[], ['cardArtId', 'name'], 'ArtFaces');

  console.timeEnd('Upload time');
};

// Unique artwork download — populates additional CardArt and CardArtFace entries
// for every alternate printing. Safe to run after default_cards (different UUIDs).
export async function scryfallArtsDownload(): Promise<void> {
  console.log('Starting arts download...');
  console.time('Arts upload time');

  const { data } = await axios.get('https://api.scryfall.com/bulk-data');
  const bulkEntry = data.data.find((e: any) => e.type === 'unique_artwork');
  if (!bulkEntry) throw new Error('unique_artwork bulk entry not found');

  const rawData: any[] = (await axios.get(bulkEntry.download_uri)).data;

  const artDocs: object[] = [];
  const artFaceDocs: object[] = [];

  for (const card of rawData) {
    if (card.layout === 'art_series' || card.layout === 'token') continue;
    if (!card.oracle_id) continue;

    const topImageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    const topArtCropUrl = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null;

    const { id, ...rest } = {
      id: card.id,
      oracleId: card.oracle_id,
      name: card.name,
      imageUrl: topImageUrl,
      artCropUrl: topArtCropUrl,
      set: card.set ?? null,
      setName: card.set_name ?? null,
      artist: card.artist ?? null,
    } satisfies SlimArt;
    artDocs.push({ _id: id, ...rest });

    for (let fi = 0; fi < (card.card_faces ?? []).length; fi++) {
      const face = card.card_faces[fi];
      artFaceDocs.push({
        cardArtId: card.id,
        name: face.name,
        order: fi,
        imageUrl: face.image_uris?.normal ?? null,
        artCropUrl: face.image_uris?.art_crop ?? null,
      } satisfies SlimArtFace);
    }
  }

  console.log(`Retrieved ${artDocs.length} art entries (${artFaceDocs.length} faces)`);

  await bulkUpsert('CardArt', artDocs as Record<string, unknown>[], ['_id'], 'Arts');
  await bulkUpsert('CardArtFace', artFaceDocs as Record<string, unknown>[], ['cardArtId', 'name'], 'ArtFaces');

  console.timeEnd('Arts upload time');
}
