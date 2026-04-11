import axios from 'axios';
import type { Card } from '../../../generated/prisma/client.js';
import prisma from '../db.js';

const CHUNK_SIZE = 500;

export default async () => {
  console.log("Starting card download ... Please Wait")

  console.time('Upload time');
  
  const {data} = await axios.get('https://api.scryfall.com/bulk-data');
  const rawData: any[] = (await axios.get(data.data[0].download_uri)).data;

  // Project to only the fields we store before filtering so the full
  // Scryfall card objects (oracle text, legalities, prices, etc.) can
  // be garbage collected immediately rather than held for the duration
  // of the upload.
  type SlimCard = { id: string; name: string; imageUrl: string | null; card_faces: { name: string; imageUrl: string | null }[] | null };
  const bulkData: SlimCard[] = rawData
    .filter((card: any) => card.layout !== 'art_series' && card.layout !== 'token')
    .map((card: any): SlimCard => ({
      id: card.id,
      name: card.name,
      imageUrl: card.image_uris?.normal ?? null,
      card_faces: card.card_faces?.map((face: any) => ({
        name: face.name,
        imageUrl: face.image_uris?.normal ?? null,
      })) ?? null,
    }));

  console.log(`Retrieved ${bulkData.length} cards`);
  console.log(`Uploading to the database...`);

  for (let i = 0; i < bulkData.length; i += CHUNK_SIZE) {
    const chunk = bulkData.slice(i, i + CHUNK_SIZE);
    console.log(`Uploading cards ${i + 1} to ${Math.min(i + CHUNK_SIZE, bulkData.length)}...`);

    const uploads = await Promise.allSettled(
      chunk.map((card) =>
        prisma.card.upsert({
          where: { id: card.id },
          update: {},
          create: card.card_faces ? {
            id: card.id,
            name: card.name,
            imageUrl: card.imageUrl,
            faces: { create: card.card_faces },
          } : {
            id: card.id,
            name: card.name,
            imageUrl: card.imageUrl,
          }
        })
      )
    );
    const results = uploads.reduce((acc: {fulfilled: number, rejected: number}, cur: PromiseSettledResult<Card>) => { acc[cur.status] += 1; return acc; }, {fulfilled: 0, rejected: 0});
    console.log(uploads.find((val) => val.status === 'rejected'));
    console.log(`Batch results — fulfilled: ${results.fulfilled}, rejected: ${results.rejected}`);
  }

  console.timeEnd('Upload time');
}