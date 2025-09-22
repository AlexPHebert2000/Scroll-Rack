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


deckRouter.post("/:id/:branch", async (req : Request, res : Response) => {
  const {id, branch} = req.params;
  const {changes, description, decklist} : {changes : {action: string, cardId: string}[], description : string, decklist : string[]}= req.body;
  const prisma = new PrismaClient();
  
  try{
    // Check for deck + branch in db
    await prisma.deck.findFirstOrThrow({
      where:{
        id
      },
      include:{
        branches:{
          where:{
            id: branch
          }
        }
      }
    });

    //update branch with new decklist and commit
    await prisma.branch.update({
      where: {id},
      data: {
        commits: {create: {
          id: createHash('sha1').update(Date.now() + id).digest('hex').toString().slice(0, 6),
          description,
          changes: {
            create: changes.map(({action, cardId}, index) => ({
              id: index,
              action,
              card: {connect: {id: cardId}}
            }))
          }
        }},
        cards: {connect: decklist.map(id => ({id}))}
      }
    });
    res.sendStatus(201);
  }
  catch(e){
    console.log(e.message);
    if (e.code === "P2025"){
      res.sendStatus(404);
    }
    else{
      res.sendStatus(500)
    }
  }
  finally{
    await prisma.$disconnect();
  }
});

export default deckRouter;