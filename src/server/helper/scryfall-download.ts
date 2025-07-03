import axios from 'axios';
import { PrismaClient } from '../../../generated/prisma/index.js';
import { create } from 'domain';

const CHUNK_SIZE = 1000;

export default async () => {
  
  console.time('Upload time');
  
  const prisma = new PrismaClient();
  
  const {data} = await axios.get('https://api.scryfall.com/bulk-data')
  const bulkData = (await axios.get(data.data[0].download_uri)).data.filter((card:any) => card.layout !== 'art_series' && card.layout !== 'token');
  
  await prisma.card.deleteMany({}); // Clear the card table before uploading new data
  
  console.log(`Uploading ${bulkData.length} cards to the database...`);
  
  for (let i = 0; i < bulkData.length; i += CHUNK_SIZE) {
    const chunk = bulkData.slice(i, i + CHUNK_SIZE);
    console.log(`Uploading cards ${i + 1} to ${Math.min(i + CHUNK_SIZE, bulkData.length)}...`);
    console.time(`Chunk ${i / CHUNK_SIZE + 1} upload time`);

    await Promise.allSettled(
      chunk.map((card:any)=> 
        prisma.card.upsert({
          where: { id: card.id },
          update:{},
          create: card.card_faces ? {
            id: card.id,
            name: card.name,
            imageUrl: card.image_uris?.normal || null,
            faces: {create: card.card_faces.map((face:any) => ({
              name: face.name,
              imageUrl: face.image_uris?.normal || null
            }))},
          } : {
            id: card.id,
            name: card.name,
            imageUrl: card.image_uris?.normal || null,
          }
        })
      )
    )
  }

  console.timeEnd('Upload time');
  await prisma.$disconnect();
  console.log('Database connection closed.');
}