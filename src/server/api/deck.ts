import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import { randomBytes, createHash } from "crypto";

const deckRouter = Router();

deckRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient();
  const {name, userId, description} = req.body;
  const commitHash = randomBytes(8).toString("base64url");
  try {
    console.log("Deck upload in progress");
    const deckUpload = await prisma.deck.create({
      data:{
        id: randomBytes(8).toString("base64url"),
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
    console.log("Deck upload done");
  }
})

export default deckRouter;