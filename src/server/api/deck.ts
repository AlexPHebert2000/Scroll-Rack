import { Router } from "express";
import type { Request, Response } from "express";
import prisma from '../db.js';
import { randomBytes } from "crypto";

const deckRouter = Router();

deckRouter.post("/", async (req : Request, res : Response) => {
  const {name, userId, description} = req.body;
  const commitHash = randomBytes(4).toString("base64url");
  const branchId = randomBytes(4).toString("base64url");
  const deckId = randomBytes(4).toString("base64url");
  try {
    console.log("Deck upload in progress");
    const deckUpload = await prisma.deck.create({
      data:{
        id: deckId,
        name,
        user: {connect : {email: userId}},
        description: description ? description : null,

        branches: {create: {
          id : branchId,
          commits: {create: {
            id: commitHash,
            description: "INIT",
          }}
        }}
      }
    });
    await prisma.branch.update({
      where: {id: branchId},
      data: {headCommitId: commitHash}
    })
    res.sendStatus(201);
  }
  catch(e){
    console.log(`Failed to create deck : ${e.message}`);
    res.status(500).json({error: "Failed to create deck"});
  }
});

deckRouter.get("/:id{/:branch}", async (req : Request, res : Response) => {
  const {id, branch} = req.params;
  try{
    const deck = await prisma.deck.findUniqueOrThrow({
      where: {id},
      include: {
        branches: {
          where: branch ? { id: branch } : { name: "main" },
          include:{
            cards: { include: { faces: true } },
            commits: {
              orderBy: { createdAt: 'desc' },
              include: {
                changes: {
                  include: { card: { select: { id: true, name: true } } }
                }
              }
            }
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
      console.log(`Failed to get deck branch : ${e.message}`)
      res.status(500).json({error: "Failed to get deck branch"});
    }
  }
});


deckRouter.post("/:id/:branch", async (req : Request, res : Response) => {
  const {id, branch} = req.params;
  const {changes, description, decklist} : {changes : {action: string, cardId: string}[], description : string, decklist : string[]}= req.body;
  
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

    const newCommitId = randomBytes(4).toString("base64url");

    //update branch with new decklist and commit
    await prisma.branch.update({
      where: {id: branch},
      data: {
        commits: {create: {
          id: newCommitId,
          description,
          changes: {
            create: changes.map(({action, cardId}) => ({
              action,
              card: {connect: {id: cardId}}
            }))
          }
        }},
        cards: {connect: decklist.map(id => ({id}))}
      }
    });
    await prisma.branch.update({
      where: {id: branch},
      data: {headCommitId: newCommitId}
    })
    res.sendStatus(201);
  }
  catch(e){
    console.log(`Failed to upload deck update : ${e.message}`);
    if (e.code === "P2025"){
      res.status(404).json({error: "Deck not found"});
    }
    else{
      res.status(500).json({error: "Failed to upload deck update"})
    }
  }
});

export default deckRouter;