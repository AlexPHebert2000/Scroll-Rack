import { Router } from "express";
import axios from "axios";
import type { Request, Response } from "express";
import prisma from '../db.js';
import scryfallDownload, { scryfallArtsDownload } from '../helper/scryfall-download.js';

const scryfallRouter = Router();

scryfallRouter.get("/search", async (req: Request, res: Response) => {
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
      include: {
        faces: true,
        // Include the default-printing CardArt (same UUID as Card)
        // via a direct lookup below rather than a relation
      },
    });

    // Fetch default-art records for all returned cards
    const cardArtMap = new Map(
      (await prisma.cardArt.findMany({
        where: { id: { in: cards.map(c => c.id) } },
        include: { faces: true },
      })).map(a => [a.id, a])
    );

    // Enrich default art from live Scryfall response if not yet in DB
    const sfOrder = new Map<string, number>(data.data.map((c: any, i: number) => [c.id, i]));
    const enriched = cards
      .map(card => {
        const sf = sfById.get(card.id);
        let defaultArt = cardArtMap.get(card.id) ?? null;

        if (defaultArt && !defaultArt.artCropUrl) {
          const liveCrop = sf?.image_uris?.art_crop ?? sf?.card_faces?.[0]?.image_uris?.art_crop ?? null;
          if (liveCrop) defaultArt = { ...defaultArt, artCropUrl: liveCrop };
        }

        return { ...card, defaultArt };
      })
      .sort((a, b) => (sfOrder.get(a.id) ?? 0) - (sfOrder.get(b.id) ?? 0));

    res.json(enriched);
  } catch (error: any) {
    console.error("Error fetching data from Scryfall:", error.message);
    res.status(500).json({ error: "Failed to fetch data from Scryfall" });
  }
});

// Register /download/arts BEFORE /download so Express doesn't swallow it
scryfallRouter.post("/download/arts", async (req: Request, res: Response) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    res.sendStatus(403); return;
  }
  try {
    await scryfallArtsDownload();
    res.sendStatus(200);
  } catch (e: any) {
    console.error("Arts download failed:", e.message);
    res.status(500).json({ error: "Arts download failed" });
  }
});

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

scryfallRouter.get("/arts", async (req: Request, res: Response) => {
  const oracleId = req.query.oracleId as string | undefined;
  if (!oracleId) {
    res.status(400).json({ error: 'oracleId query parameter is required' });
    return;
  }
  try {
    const arts = await prisma.cardArt.findMany({
      where: { oracleId },
      include: { faces: true },
      orderBy: [{ setName: 'asc' }, { artist: 'asc' }],
    });
    res.json(arts);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch arts' });
  }
});

export default scryfallRouter;
