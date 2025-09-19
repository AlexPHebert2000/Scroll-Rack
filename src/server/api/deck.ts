import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import { getHashes, createHash } from "crypto";

const deckRouter = Router();

deckRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient();
  const {name, userId, description} = req.body;
  const hash = getHashes();
  const commitHash = createHash('sha1').update(Date.now() + userId).digest('hex').toString()
  try {
    console.log("Deck upload in progress");
    const deckUpload = await prisma.deck.create({
      data:{
        id: createHash('sha1').update(Date.now() + userId).digest('hex').toString(),
        name,
        user: {connect : {email: userId}},
        description: description ? description : null,

        branches: {create: {
          id : createHash('sha1').update(Date.now() + userId).digest('hex').toString(),
          headCommitId: commitHash,

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