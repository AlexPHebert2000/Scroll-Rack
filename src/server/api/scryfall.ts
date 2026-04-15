import { Router } from "express";
import axios from "axios";
import type { Request, Response } from "express";
import prisma from '../db.js';

const scryfallRouter = Router();

scryfallRouter.get("/search", async (req :Request , res :Response) => {
  try {
    const qString = req.query.qString as string | undefined;
    if (!qString) {
      res.status(400).json({ error: 'qString query parameter is required' });
      return;
    }
    const { data } = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(qString)}`);
    const cards = await prisma.card.findMany({
      where: { id: { in: data.data.map((card: any) => card.id) } },
      include: { faces: true },
    });
    res.json(cards);
  }

  catch (error) {
    console.error("Error fetching data from Scryfall:", error.message);
    res.status(500).json({ error: "Failed to fetch data from Scryfall" });
  }
})

export default scryfallRouter;