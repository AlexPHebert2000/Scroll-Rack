import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import shortId from '../helper/shortId.js';
import { connect } from "http2";

const deckRouter = Router();

deckRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient();
  const {name, userId, description} = req.body;
  try {
    await prisma.$transaction(async (tx) => {

      const deck = await tx.deck.create({
        data:{
          id: shortId(),
          name,
          description,
          user: {connect: {email: userId}}
        }
      });

      const branch = await tx.branch.create({
        data:{
          id: shortId(),
          name: "main",
          deck: {connect: {id: deck.id}},
          defaultBranchOf: {connect: {id: deck.id}}
        }
      });

      await tx.commit.create({
        data:{
          id: shortId(),
          description: "INIT",
          branch: {connect: {id: branch.id}},
          headBranchOf: {connect: {id: branch.id}}
        }
      });
    })

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

deckRouter.get("/:id{/:branchID}", async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  const {id, branchID} = req.params;
  try{
    let deck;
    if (branchID){
      deck = await prisma.deck.findUniqueOrThrow({
        where: {id},
        include: {
          cards: true,
          defaultBranch:{
            include: {
              commits: {orderBy: {createdAt: "desc"}},
              headCommit: true,
            }
          }
        }
      });
    }
    else {
      deck = await prisma.deck.findUniqueOrThrow({
        where: {id},
        include: {
          cards: true,
          branches: {
            where:{name: "main"},
            include: {
              commits: true
            }
          }
        }
      });
    }
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