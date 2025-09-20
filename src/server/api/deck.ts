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
});

deckRouter.get("/:id/:branch", async (req : Request, res : Response) => {
  const {id, branch} = req.params;
  const prisma = new PrismaClient();
  try{
    const deck = await prisma.deck.findUniqueOrThrow({
      where: {id},
      include: {
        branches: {
          where: {
            id: branch
          },
          include:{
            cards: true
          }
        }
      }
    });
    res.send(deck);
  }
  catch(e){
    if(e.name === "PrismaClientKnownRequestError"){
      console.log(`${e.meta.cause} : ${id}`);
      res.sendStatus(404);
    }
    else{
      console.log(e.message)
      res.sendStatus(500);
    }
  }
  finally{
    await prisma.$disconnect()
  }
});

export default deckRouter;