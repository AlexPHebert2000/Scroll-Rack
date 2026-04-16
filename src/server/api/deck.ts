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
  const decklistId = randomBytes(4).toString("base64url");
  try {
    console.log("Deck upload in progress");
    await prisma.$transaction([
      prisma.deck.create({
        data:{
          id: deckId,
          name,
          user: {connect : {email: userId}},
          description: description ? description : null,

          branches: {create: {
            id : branchId,
            decklist: { create: { id: decklistId } },
            commits: {create: {
              id: commitHash,
              description: "INIT",
            }}
          }}
        }
      }),
      prisma.branch.update({
        where: {id: branchId},
        data: {headCommitId: commitHash}
      })
    ]);
    res.sendStatus(201);
  }
  catch(e){
    console.log(`Failed to create deck : ${e.message}`);
    res.status(500).json({error: "Failed to create deck"});
  }
});

// Must be registered before /:id/:branch to prevent "branch" being captured as a param
deckRouter.post("/:id/branch", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sourceCommitId, branchName: customName }: { sourceCommitId: string; branchName?: string } = req.body;

  try {
    // Find the branch owning this commit, verifying it belongs to the deck
    const sourceBranch = await prisma.branch.findFirstOrThrow({
      where: { deckId: id, commits: { some: { id: sourceCommitId } } },
      include: {
        commits: {
          orderBy: { createdAt: 'asc' },
          include: { changes: true },
        },
      },
    });

    const targetIndex = sourceBranch.commits.findIndex(c => c.id === sourceCommitId);
    if (targetIndex === -1) {
      return res.status(404).json({ error: "Commit not found" });
    }

    // Replay changes from oldest commit up to and including the target
    const targetCards = new Set<string>();
    for (let i = 0; i <= targetIndex; i++) {
      for (const change of sourceBranch.commits[i].changes) {
        if (change.action === 'ADD') targetCards.add(change.cardId);
        else targetCards.delete(change.cardId);
      }
    }

    const sourceDescription = sourceBranch.commits[targetIndex].description;
    const defaultName = sourceDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const branchName = customName?.trim() || defaultName;

    const newBranchId = randomBytes(4).toString("base64url");
    const seedCommitId = randomBytes(4).toString("base64url");
    const newDecklistId = randomBytes(4).toString("base64url");

    await prisma.$transaction([
      prisma.branch.create({
        data: {
          id: newBranchId,
          name: branchName,
          deck: { connect: { id } },
          decklist: {
            create: {
              id: newDecklistId,
              mainDeck: { connect: [...targetCards].map(cid => ({ id: cid })) },
            },
          },
          commits: {
            create: {
              id: seedCommitId,
              description: `Branched from "${sourceDescription}"`,
              changes: {
                create: [...targetCards].map(cardId => ({
                  action: 'ADD',
                  board: 'MAIN',
                  card: { connect: { id: cardId } },
                })),
              },
            },
          },
        },
      }),
      prisma.branch.update({
        where: { id: newBranchId },
        data: { headCommitId: seedCommitId },
      }),
    ]);

    res.status(201).json({ branchId: newBranchId, branchName });
  } catch (e) {
    console.log(`Failed to create branch : ${e.message}`);
    if (e.code === 'P2025') {
      res.status(404).json({ error: "Deck or commit not found" });
    } else {
      res.status(500).json({ error: "Failed to create branch" });
    }
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
            decklist: {
              include: {
                mainDeck: { include: { faces: true } },
                sideBoard: { include: { faces: true } },
              },
            },
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
    const allBranches = await prisma.branch.findMany({
      where: { deckId: id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.send({ ...deck, allBranches });
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
  const {changes, description, mainDeck, sideBoard} : {changes : {action: string, board: string, cardId: string}[], description : string, mainDeck : string[], sideBoard: string[]}= req.body;

  try{
    // Check for deck + branch in db, and get the branch's decklistId
    const foundDeck = await prisma.deck.findFirstOrThrow({
      where:{
        id
      },
      include:{
        branches:{
          where:{
            id: branch
          },
          select: { id: true, decklistId: true }
        }
      }
    });
    const decklistId = foundDeck.branches[0].decklistId;

    const newCommitId = randomBytes(4).toString("base64url");

    //update branch with new decklist and commit
    await prisma.$transaction([
      prisma.branch.update({
        where: {id: branch},
        data: {
          commits: {create: {
            id: newCommitId,
            description,
            changes: {
              create: changes.map(({action, board, cardId}) => ({
                action,
                board,
                card: {connect: {id: cardId}}
              }))
            }
          }},
        }
      }),
      prisma.decklist.update({
        where: {id: decklistId},
        data: {
          mainDeck: {set: mainDeck.map(id => ({id}))},
          sideBoard: {set: sideBoard.map(id => ({id}))},
        }
      }),
      prisma.branch.update({
        where: {id: branch},
        data: {headCommitId: newCommitId}
      })
    ]);
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
