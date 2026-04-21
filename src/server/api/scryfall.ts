import { Router } from "express";
import axios from "axios";
import type { Request, Response } from "express";
import prisma from '../db.js';
import scryfallDownload from '../helper/scryfall-download.js';

const scryfallRouter = Router();

scryfallRouter.get("/search", async (req :Request , res :Response) => {
  try {
    const qString = req.query.qString as string | undefined;
    if (!qString) {
      res.status(400).json({ error: 'qString query parameter is required' });
      return;
    }
    const { data } = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(qString)}`);
    const sfById = new Map<string, any>(data.data.map((c: any) => [c.id, c]));

    const cards = await prisma.card.findMany({
      where: { id: { in: data.data.map((card: any) => card.id) } },
      include: { faces: true },
    });

    // Enrich with art_crop from live Scryfall response (DB may not have it yet)
    const enriched = cards.map(card => {
      const sf = sfById.get(card.id);
      const artCropUrl = card.artCropUrl
        ?? sf?.image_uris?.art_crop
        ?? sf?.card_faces?.[0]?.image_uris?.art_crop
        ?? null;
      const faces = card.faces.map((face: any, i: number) => ({
        ...face,
        artCropUrl: face.artCropUrl ?? sf?.card_faces?.[i]?.image_uris?.art_crop ?? null,
      }));
      return { ...card, artCropUrl, faces };
    });

    res.json(enriched);
  }

  catch (error: any) {
    console.error("Error fetching data from Scryfall:", error.message);
    res.status(500).json({ error: "Failed to fetch data from Scryfall" });
  }
})

scryfallRouter.post("/download", async (req: Request, res: Response) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    res.sendStatus(403); return;
  }
  try {
    await scryfallDownload();
    res.sendStatus(200);
  } catch (e: any) {
    console.error("Download failed:", e.message);
    res.status(500).json({ error: "Download failed" });
  }
});

export default scryfallRouter;