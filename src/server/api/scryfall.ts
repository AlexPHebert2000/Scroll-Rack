import { Router } from "express";
import axios from "axios";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';

const scryfallRouter = Router();

scryfallRouter.get("/search", async (req :Request , res :Response) => {
  const prisma = new PrismaClient();
  try {
    const qString = req.query.qString;
    const { data } = await axios.get(`https://api.scryfall.com/cards/search?q=${qString}`);
    const cards = await prisma.card.findMany({
      where: { id: { in: data.data.map((card: any) => card.id) } },
      include: { faces: true },
    });
    res.json(cards);
  }

  catch (error) {
    console.error("Error fetching data from Scryfall:", error);
    res.status(500).json({ error: "Failed to fetch data from Scryfall" });
  }
  
  finally {
    await prisma.$disconnect();
  }
})

export default scryfallRouter;