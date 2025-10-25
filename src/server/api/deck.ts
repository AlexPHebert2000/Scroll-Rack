import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import shortId from '../helper/shortId.js';

const deckRouter = Router();

deckRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient();
  const {name, userId, description} = req.body;
  const commitHash = shortId()
  try {
    await prisma.deck.create({
      data:{
        id: shortId(),
        name,
        user: {connect : {email: userId}},
        description: description ? description : null,

        branches: {create: {
          id :shortId(),
          headCommitId: commitHash,
          name: "main",
          commits: {create: {
            id: commitHash,
            description: "INIT",
          }}

        }}

      }
    });

    res.sendStatus(201);
  }
  catch(e){
    res.sendStatus(500);
    console.log(e.message);
  }
  finally{
    await prisma.$disconnect();
  }
});

deckRouter.get("/:id", async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  const {id} = req.params;
  try{
    const deck = await prisma.deck.findUniqueOrThrow({
      where: {id},
      include: {
        cards: true,
        branches: {
          where: {name: "main"},
          include: {
            commits: true
          }
        }
      }
    });
    res.json(deck);
  }
  catch(e){
    if (e.code === 'P2025'){
      res.status(404).json({error: "deck not found"})
    }
    else {
      res.sendStatus(500);
    }
  }
  finally{
    await prisma.$disconnect();
  }
});

export default deckRouter;