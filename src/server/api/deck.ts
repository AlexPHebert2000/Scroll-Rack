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
    console.log("Deck upload in progress");
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
})

export default deckRouter;