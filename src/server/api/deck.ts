import { Router } from "express";
import type { Request, Response } from "express";
import prisma from '../db.js';
import { randomUUID } from "crypto";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const deckRouter = Router();

const createDeckSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const createBranchSchema = z.object({
  sourceCommitId: z.string().min(1),
  branchName: z.string().min(1).max(50).optional(),
});

const commitSchema = z.object({
  changes: z.array(z.object({
    action: z.enum(['ADD', 'REMOVE']),
    board: z.enum(['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING']),
    cardId: z.string().min(1),
  })).min(1),
  description: z.string().min(1).max(500),
  mainDeck: z.array(z.string()),
  sideBoard: z.array(z.string()).default([]),
  commander: z.array(z.string()).default([]),
});

// Fetch cards by ID arrays and return a name-keyed map with faces
async function resolveCards(ids: string[]) {
  if (ids.length === 0) return new Map();
  const cards = await prisma.card.findMany({
    where: { id: { in: ids } },
    include: { faces: true },
  });
  return new Map(cards.map(c => [c.id, c]));
}

deckRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = createDeckSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { name, description } = parsed.data;
  const commitId = randomUUID();
  const branchId = randomUUID();
  const deckId = randomUUID();
  const decklistId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.deck.create({
        data: {
          id: deckId,
          name,
          user: { connect: { email: req.userEmail } },
          description: description ?? null,
          branches: {
            create: {
              id: branchId,
              decklist: { create: { id: decklistId } },
              commits: { create: { id: commitId, description: "INIT" } },
            },
          },
        },
      });
      await tx.branch.update({ where: { id: branchId }, data: { headCommitId: commitId } });
    });
    res.status(201).json({ deckId });
  } catch (e: any) {
    console.log(`Failed to create deck : ${e.message}`);
    res.status(500).json({ error: "Failed to create deck" });
  }
});

deckRouter.post("/:id/branch", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;

  const parsed = createBranchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { sourceCommitId, branchName: customName } = parsed.data;

  try {
    const sourceBranch = await prisma.branch.findFirstOrThrow({
      where: { deckId: id, deck: { userEmail: req.userEmail }, commits: { some: { id: sourceCommitId } } },
      include: {
        commits: {
          orderBy: { createdAt: 'asc' },
          include: { changes: true },
        },
      },
    });

    const targetIndex = sourceBranch.commits.findIndex(c => c.id === sourceCommitId);
    if (targetIndex === -1) {
      res.status(404).json({ error: "Commit not found" }); return;
    }

    // Board-aware replay up to and including the target commit
    const boardCards: Record<string, Set<string>> = {
      MAIN: new Set(), COMMANDER: new Set(), SIDE: new Set(), CONSIDERING: new Set(),
    };
    for (let i = 0; i <= targetIndex; i++) {
      for (const change of sourceBranch.commits[i].changes) {
        const board = boardCards[change.board] ?? (boardCards[change.board] = new Set());
        if (change.action === 'ADD') board.add(change.cardId);
        else board.delete(change.cardId);
      }
    }

    const sourceDescription = sourceBranch.commits[targetIndex].description;
    const defaultName = sourceDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const branchName = customName?.trim() || defaultName;

    const newBranchId = randomUUID();
    const seedCommitId = randomUUID();
    const newDecklistId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.branch.create({
        data: {
          id: newBranchId,
          name: branchName,
          deck: { connect: { id } },
          decklist: {
            create: {
              id: newDecklistId,
              mainDeckIds: [...boardCards.MAIN],
              commanderIds: [...boardCards.COMMANDER],
              sideboardIds: [...boardCards.SIDE],
            },
          },
          commits: {
            create: {
              id: seedCommitId,
              description: `Branched from "${sourceDescription}"`,
              changes: {
                create: Object.entries(boardCards).flatMap(([board, cards]) =>
                  [...cards].map(cardId => ({
                    action: 'ADD' as const,
                    board: board as any,
                    card: { connect: { id: cardId } },
                  }))
                ),
              },
            },
          },
        },
      });
      await tx.branch.update({ where: { id: newBranchId }, data: { headCommitId: seedCommitId } });
    });

    res.status(201).json({ branchId: newBranchId, branchName });
  } catch (e: any) {
    console.log(`Failed to create branch : ${e.message}`);
    if (e.code === 'P2025') {
      res.status(404).json({ error: "Deck or commit not found" });
    } else {
      res.status(500).json({ error: "Failed to create branch" });
    }
  }
});


deckRouter.get("/:id{/:branch}", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;
  try {
    const deck = await prisma.deck.findUniqueOrThrow({
      where: { id, userEmail: req.userEmail },
      include: {
        branches: {
          where: branch ? { id: branch } : { name: "main" },
          include: {
            decklist: true,
            commits: {
              orderBy: { createdAt: 'desc' },
              include: {
                changes: {
                  include: { card: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });

    // Resolve card ID arrays to full card objects (maintaining original order)
    const resolvedBranches = await Promise.all(
      deck.branches.map(async (b) => {
        const allIds = [...b.decklist.mainDeckIds, ...b.decklist.sideboardIds, ...b.decklist.commanderIds];
        const cardMap = await resolveCards(allIds);
        return {
          ...b,
          decklist: {
            ...b.decklist,
            mainDeck: b.decklist.mainDeckIds.map(cid => cardMap.get(cid)).filter(Boolean),
            sideBoard: b.decklist.sideboardIds.map(cid => cardMap.get(cid)).filter(Boolean),
            commander: b.decklist.commanderIds.map(cid => cardMap.get(cid)).filter(Boolean),
          },
        };
      })
    );

    const allBranches = await prisma.branch.findMany({
      where: { deckId: id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.send({ ...deck, branches: resolvedBranches, allBranches });
  } catch (e: any) {
    if (e.name === "PrismaClientKnownRequestError") {
      console.log(`${e.meta?.cause} : ${id}`);
      res.sendStatus(404);
    } else {
      console.log(`Failed to get deck branch : ${e.message}`);
      res.status(500).json({ error: "Failed to get deck branch" });
    }
  }
});

deckRouter.post("/:id/:branch", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;

  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { changes, description, mainDeck, sideBoard, commander } = parsed.data;

  try {
    const foundDeck = await prisma.deck.findFirstOrThrow({
      where: { id, userEmail: req.userEmail },
      include: {
        branches: {
          where: { id: branch },
          select: { id: true, decklistId: true },
        },
      },
    });

    if (foundDeck.branches.length === 0) {
      res.status(404).json({ error: "Branch not found" }); return;
    }

    const decklistId = foundDeck.branches[0].decklistId;
    const newCommitId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch },
        data: {
          commits: {
            create: {
              id: newCommitId,
              description,
              changes: {
                create: changes.map(({ action, board, cardId }) => ({
                  action,
                  board,
                  card: { connect: { id: cardId } },
                })),
              },
            },
          },
        },
      });
      await tx.decklist.update({
        where: { id: decklistId },
        data: {
          mainDeckIds: mainDeck,
          sideboardIds: sideBoard,
          commanderIds: commander,
        },
      });
      await tx.branch.update({
        where: { id: branch },
        data: { headCommitId: newCommitId },
      });
    });
    res.sendStatus(201);
  } catch (e: any) {
    console.log(`Failed to upload deck update : ${e.message}`);
    if (e.code === "P2025") {
      res.status(404).json({ error: "Deck not found" });
    } else {
      res.status(500).json({ error: "Failed to upload deck update" });
    }
  }
});

deckRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const branches = await prisma.branch.findMany({
      where: { deckId: id, deck: { userEmail: req.userEmail } },
      select: { id: true, decklistId: true },
    });

    if (branches.length === 0) {
      const deck = await prisma.deck.findUnique({ where: { id } });
      res.status(deck ? 403 : 404).json({ error: deck ? "Forbidden" : "Deck not found" }); return;
    }

    const branchIds = branches.map(b => b.id);
    const decklistIds = branches.map(b => b.decklistId);

    const commits = await prisma.commit.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true },
    });
    const commitIds = commits.map(c => c.id);

    // MongoDB has no FK cascade — delete in dependency order
    await prisma.change.deleteMany({ where: { commitId: { in: commitIds } } });
    await prisma.snapShot.deleteMany({ where: { decklistId: { in: decklistIds } } });
    await prisma.commit.deleteMany({ where: { id: { in: commitIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
    await prisma.decklist.deleteMany({ where: { id: { in: decklistIds } } });
    await prisma.deck.delete({ where: { id } });

    res.sendStatus(204);
  } catch (e: any) {
    console.log(`Failed to delete deck : ${e.message}`);
    res.status(500).json({ error: "Failed to delete deck" });
  }
});

deckRouter.delete("/:id/:branch", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;
  try {
    const [foundBranch, branchCount] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: branch, deckId: id, deck: { userEmail: req.userEmail } },
        select: { decklistId: true },
      }),
      prisma.branch.count({ where: { deckId: id, deck: { userEmail: req.userEmail } } }),
    ]);

    if (!foundBranch) {
      res.status(404).json({ error: "Branch not found" }); return;
    }
    if (branchCount <= 1) {
      res.status(400).json({ error: "Cannot delete the last branch on a deck" }); return;
    }

    const commits = await prisma.commit.findMany({
      where: { branchId: branch },
      select: { id: true },
    });
    const commitIds = commits.map(c => c.id);

    await prisma.change.deleteMany({ where: { commitId: { in: commitIds } } });
    await prisma.snapShot.deleteMany({ where: { decklistId: foundBranch.decklistId } });
    await prisma.commit.deleteMany({ where: { id: { in: commitIds } } });
    await prisma.branch.delete({ where: { id: branch } });
    await prisma.decklist.delete({ where: { id: foundBranch.decklistId } });

    res.sendStatus(204);
  } catch (e: any) {
    console.log(`Failed to delete branch : ${e.message}`);
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

export default deckRouter;
