import axios from 'axios';
import { PrismaClient } from '../../../generated/prisma/index.js';
import { create } from 'domain';

const CHUNK_SIZE = 1000;

export default async () => {
  const prisma = new PrismaClient();
  const {data} = await axios.get('https://api.scryfall.com/bulk-data')
  const bulkData = (await axios.get(data.data[0].download_uri)).data.filter(card => card.layout !== 'art_series' && card.layout !== 'token');
  const uploads = [];
  await prisma.card.deleteMany({});
  console.log(`Uploading ${bulkData.length} cards to the database...`);
  for (let i = 0; i < bulkData.length; i += CHUNK_SIZE) {
    const chunk = bulkData.slice(i, i + CHUNK_SIZE);
    console.log(`Uploading cards ${i + 1} to ${Math.min(i + CHUNK_SIZE, bulkData.length)}...`);
    console.time(`Chunk ${i / CHUNK_SIZE + 1} upload time`);
    const upload = prisma.card.createMany({
      data: chunk.map(card => ({
        id: card.id,
        name: card.name,
        imageUrl: card.image_uris?.normal || null, // Use normal image if available, otherwise null
      })),
    })
    .then(() => {
      console.timeEnd(`Chunk ${i / CHUNK_SIZE + 1} upload time`);
    })
    .catch(error => {
      console.error(`Error uploading chunk ${i / CHUNK_SIZE + 1}:`, error);
    });
    uploads.push(upload);
  }
  await Promise.allSettled(uploads)
  .then((outcome) => {
    const failedUploads = outcome.filter(result => result.status === 'rejected');
    if (failedUploads.length > 0) {
      console.error(`Failed to upload ${failedUploads.length} chunks.`);
    } else {
      console.log('All chunks uploaded successfully.');
    }
  }) 
}