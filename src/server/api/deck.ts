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
    count: z.number().int().min(1).default(1),
  })).min(1),
  description: z.string().min(1).max(500),
  mainDeck: z.array(z.string()),
  sideBoard: z.array(z.string()).default([]),
  commander: z.array(z.string()).default([]),
  considering: z.array(z.string()).default([]),
  portraitUrl: z.string().nullable().optional(),
});

const portraitSchema = z.object({
  portraitUrl: z.string().url(),
});

function toCounts(ids: string[]): Map<string, number> {
  const m = new Map<string, number>();
  ids.forEach(id => m.set(id, (m.get(id) ?? 0) + 1));
  return m;
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

    // Board-aware replay up to and including the target commit, tracking counts
    const boardCards: Record<string, Map<string, number>> = {
      MAIN: new Map(), COMMANDER: new Map(), SIDE: new Map(), CONSIDERING: new Map(),
    };
    for (let i = 0; i <= targetIndex; i++) {
      for (const change of sourceBranch.commits[i].changes) {
        const board = boardCards[change.board] ?? (boardCards[change.board] = new Map());
        const count = (change as any).count ?? 1;
        if (change.action === 'ADD') {
          board.set(change.cardId, (board.get(change.cardId) ?? 0) + count);
        } else {
          const next = (board.get(change.cardId) ?? 0) - count;
          if (next <= 0) board.delete(change.cardId);
          else board.set(change.cardId, next);
        }
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
          decklist: { create: { id: newDecklistId } },
          commits: {
            create: {
              id: seedCommitId,
              description: `Branched from "${sourceDescription}"`,
              changes: {
                create: Object.entries(boardCards).flatMap(([board, cards]) =>
                  [...cards.entries()].map(([cardId, count]) => ({
                    action: 'ADD' as const,
                    board: board as any,
                    count,
                    card: { connect: { id: cardId } },
                  }))
                ),
              },
            },
          },
        },
      });

      const deckCardData = Object.entries(boardCards).flatMap(([board, cards]) =>
        [...cards.entries()].map(([cardId, count]) => ({
          decklistId: newDecklistId,
          cardId,
          board: board as any,
          count,
        }))
      );
      if (deckCardData.length > 0) {
        await tx.deckCard.createMany({ data: deckCardData });
      }

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
            decklist: {
              include: {
                deckCards: {
                  include: { card: { include: { faces: true } } },
                },
              },
            },
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

    const byBoard = (deckCards: typeof deck.branches[0]['decklist']['deckCards'], board: string) =>
      deckCards
        .filter(dc => dc.board === board)
        .flatMap(dc => Array(dc.count).fill(dc.card));

    const resolvedBranches = deck.branches.map(b => ({
      ...b,
      decklist: {
        mainDeck: byBoard(b.decklist.deckCards, 'MAIN'),
        sideBoard: byBoard(b.decklist.deckCards, 'SIDE'),
        commander: byBoard(b.decklist.deckCards, 'COMMANDER'),
        considering: byBoard(b.decklist.deckCards, 'CONSIDERING'),
      },
    }));

    const [allBranches, graphBranches] = await Promise.all([
      prisma.branch.findMany({
        where: { deckId: id },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.branch.findMany({
        where: { deckId: id },
        select: {
          id: true,
          name: true,
          commits: {
            select: { id: true, description: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    res.send({ ...deck, branches: resolvedBranches, allBranches, graphBranches });
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

  const { changes, description, mainDeck, sideBoard, commander, considering, portraitUrl } = parsed.data;

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

    const mainCounts = toCounts(mainDeck);
    const sideCounts = toCounts(sideBoard);
    const commanderCounts = toCounts(commander);
    const consideringCounts = toCounts(considering);

    await prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch },
        data: {
          commits: {
            create: {
              id: newCommitId,
              description,
              changes: {
                create: changes.map(({ action, board, cardId, count }) => ({
                  action,
                  board,
                  count,
                  card: { connect: { id: cardId } },
                })),
              },
            },
          },
        },
      });

      for (const [board, counts] of [['MAIN', mainCounts], ['SIDE', sideCounts], ['COMMANDER', commanderCounts], ['CONSIDERING', consideringCounts]] as const) {
        await tx.deckCard.deleteMany({ where: { decklistId, board } });
        if (counts.size > 0) {
          await tx.deckCard.createMany({
            data: [...counts.entries()].map(([cardId, count]) => ({
              decklistId, cardId, board, count,
            })),
          });
        }
      }

      await tx.branch.update({
        where: { id: branch },
        data: { headCommitId: newCommitId },
      });
      if (portraitUrl && !foundDeck.portraitUrl) {
        await tx.deck.update({ where: { id }, data: { portraitUrl } });
      }
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

deckRouter.patch("/:id/portrait", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = portraitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    await prisma.deck.update({
      where: { id, userEmail: req.userEmail },
      data: { portraitUrl: parsed.data.portraitUrl },
    });
    res.sendStatus(200);
  } catch (e: any) {
    if (e.code === 'P2025') res.status(404).json({ error: 'Deck not found' });
    else res.status(500).json({ error: 'Failed to update portrait' });
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

    await prisma.change.deleteMany({ where: { commitId: { in: commitIds } } });
    await prisma.snapShot.deleteMany({ where: { decklistId: { in: decklistIds } } });
    await prisma.commit.deleteMany({ where: { id: { in: commitIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
    await prisma.deckCard.deleteMany({ where: { decklistId: { in: decklistIds } } });
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
    await prisma.deckCard.deleteMany({ where: { decklistId: foundBranch.decklistId } });
    await prisma.decklist.delete({ where: { id: foundBranch.decklistId } });

    res.sendStatus(204);
  } catch (e: any) {
    console.log(`Failed to delete branch : ${e.message}`);
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

export default deckRouter;
