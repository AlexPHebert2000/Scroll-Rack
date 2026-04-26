import { Router } from "express";
import type { Request, Response } from "express";
import prisma from '../db.js';
import { randomUUID } from "crypto";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { generateCommitDescription } from '../helper/commitDescription.js';

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

const workingTreeSchema = z.object({
  changes: z.array(z.object({
    action: z.enum(['ADD', 'REMOVE']),
    board: z.enum(['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING']),
    cardId: z.string().min(1),
    count: z.number().int().min(1),
  })),
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
          include: {
            changes: true,
            snapshot: { select: { decklistId: true } },
          },
        },
      },
    });

    const targetIndex = sourceBranch.commits.findIndex(c => c.id === sourceCommitId);
    if (targetIndex === -1) {
      res.status(404).json({ error: "Commit not found" }); return;
    }

    // Find the nearest snapshot at or before the target commit
    let snapshotDecklistId: string | null = null;
    let snapshotIndex = -1;
    for (let i = targetIndex; i >= 0; i--) {
      if (sourceBranch.commits[i].snapshot) {
        snapshotDecklistId = sourceBranch.commits[i].snapshot!.decklistId;
        snapshotIndex = i;
        break;
      }
    }

    const boardCards: Record<string, Map<string, number>> = {
      MAIN: new Map(), COMMANDER: new Map(), SIDE: new Map(), CONSIDERING: new Map(),
    };

    if (snapshotDecklistId) {
      const snapshotDecklist = await prisma.decklist.findUnique({
        where: { id: snapshotDecklistId },
        include: { deckCards: true },
      });
      if (snapshotDecklist) {
        for (const dc of snapshotDecklist.deckCards) {
          (boardCards[dc.board] ?? (boardCards[dc.board] = new Map())).set(dc.cardId, dc.count);
        }
      }
    }

    // Replay only the commits after the snapshot (or all if no snapshot found)
    const replayFrom = snapshotIndex + 1;
    for (let i = replayFrom; i <= targetIndex; i++) {
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


// ── Historical commit snapshot ────────────────────────────────────────────────

deckRouter.get("/:id/:branch/:commit", requireAuth, async (req: Request, res: Response) => {
  const { id, branch, commit } = req.params;

  try {
    const foundBranch = await prisma.branch.findFirst({
      where: { id: branch, deckId: id, deck: { userEmail: req.userEmail } },
      include: {
        commits: {
          orderBy: { createdAt: 'asc' },
          include: {
            changes: {
              include: { card: { include: { faces: true } } },
            },
          },
        },
      },
    });

    if (!foundBranch) { res.status(404).json({ error: 'Branch not found' }); return; }

    const targetIdx = foundBranch.commits.findIndex(c => c.id === commit);
    if (targetIdx === -1) { res.status(404).json({ error: 'Commit not found' }); return; }

    const boardCards: Record<string, Map<string, { card: any; count: number }>> = {
      MAIN: new Map(), SIDE: new Map(), COMMANDER: new Map(), CONSIDERING: new Map(),
    };

    for (let i = 0; i <= targetIdx; i++) {
      for (const change of foundBranch.commits[i].changes) {
        const board = boardCards[change.board];
        const current = board.get(change.cardId);
        if (change.action === 'ADD') {
          if (current) current.count += change.count;
          else board.set(change.cardId, { card: change.card, count: change.count });
        } else if (current) {
          current.count -= change.count;
          if (current.count <= 0) board.delete(change.cardId);
        }
      }
    }

    const toList = (board: Map<string, { card: any; count: number }>) =>
      [...board.values()].flatMap(({ card, count }) => Array(count).fill(card));

    res.json({
      mainDeck: toList(boardCards.MAIN),
      sideBoard: toList(boardCards.SIDE),
      commander: toList(boardCards.COMMANDER),
      considering: toList(boardCards.CONSIDERING),
    });
  } catch (e: any) {
    console.log(`Failed to fetch commit snapshot: ${e.message}`);
    res.status(500).json({ error: 'Failed to fetch commit snapshot' });
  }
});

deckRouter.get("/:id{/:branch}", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;
  const sessionId = req.sessionId;
  try {
    const deck = await prisma.deck.findUniqueOrThrow({
      where: { id, userEmail: req.userEmail },
      include: {
        branches: {
          where: branch ? { id: branch } : { name: "main" },
          include: {
            workingTree: {
              select: {
                id: true, lastModifiedAt: true, lastSessionId: true,
                stagedChanges: {
                  select: {
                    action: true, board: true, cardId: true, count: true,
                    card: { select: { id: true, name: true, imageUrl: true, artCropUrl: true, typeLine: true, cmc: true, oracleText: true, layout: true, faces: true } },
                  },
                },
              },
            },
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
      workingTree: b.workingTree ? {
        lastModifiedAt: b.workingTree.lastModifiedAt,
        isCurrentSession: b.workingTree.lastSessionId === sessionId,
        stagedChanges: b.workingTree.stagedChanges,
      } : null,
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

// ── Working tree sync ────────────────────────────────────────────────────────

deckRouter.put("/:id/:branch/working-tree", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;
  const sessionId = req.sessionId;

  const parsed = workingTreeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { changes } = parsed.data;

  try {
    const foundBranch = await prisma.branch.findFirst({
      where: { id: branch, deckId: id, deck: { userEmail: req.userEmail } },
      include: { workingTree: { select: { id: true, lastSessionId: true } } },
    });

    if (!foundBranch) { res.status(404).json({ error: 'Branch not found' }); return; }

    const existingTree = foundBranch.workingTree;

    if (changes.length === 0) {
      if (existingTree) {
        await prisma.workingTree.delete({ where: { id: existingTree.id } });
      }
      res.json({ conflict: false });
      return;
    }

    let conflict = false;

    if (existingTree) {
      // Conflict fires only on the first write from a new session
      if (existingTree.lastSessionId && existingTree.lastSessionId !== sessionId) {
        conflict = true;
      }

      await prisma.$transaction(async (tx) => {
        await tx.stagedChange.deleteMany({ where: { workingTreeId: existingTree.id } });
        await tx.workingTree.update({
          where: { id: existingTree.id },
          data: { lastSessionId: sessionId },
        });
        if (changes.length > 0) {
          await tx.stagedChange.createMany({
            data: changes.map(({ action, board, cardId, count }) => ({
              action, board, count, cardId, workingTreeId: existingTree.id,
            })),
          });
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const newTree = await tx.workingTree.create({
          data: { branchId: branch, lastSessionId: sessionId },
        });
        await tx.stagedChange.createMany({
          data: changes.map(({ action, board, cardId, count }) => ({
            action, board, count, cardId, workingTreeId: newTree.id,
          })),
        });
      });
    }

    res.json({ conflict });
  } catch (e: any) {
    console.log(`Failed to update working tree: ${e.message}`);
    res.status(500).json({ error: 'Failed to update working tree' });
  }
});

// ── Quick commit ─────────────────────────────────────────────────────────────

deckRouter.post("/:id/:branch/quick-commit", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;
  const sessionId = req.sessionId;

  try {
    const foundBranch = await prisma.branch.findFirst({
      where: { id: branch, deckId: id, deck: { userEmail: req.userEmail } },
      include: {
        _count: { select: { commits: true } },
        workingTree: {
          include: {
            stagedChanges: {
              include: { card: { select: { id: true, name: true, artCropUrl: true } } },
            },
          },
        },
        decklist: { include: { deckCards: true } },
        deck: { select: { id: true, portraitUrl: true } },
      },
    });

    if (!foundBranch) { res.status(404).json({ error: 'Branch not found' }); return; }

    const workingTree = foundBranch.workingTree;
    if (!workingTree || workingTree.stagedChanges.length === 0) {
      res.status(400).json({ error: 'No staged changes to commit' }); return;
    }

    // Validate all card IDs exist in the collection
    const cardIds = [...new Set(workingTree.stagedChanges.map(c => c.cardId))];
    const foundCards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: { id: true },
    });
    if (foundCards.length !== cardIds.length) {
      res.status(400).json({ error: 'One or more card IDs not found in collection' }); return;
    }

    const decklistId = foundBranch.decklistId;
    const newCommitId = randomUUID();

    // Compute final deck state by applying staged changes to current DeckCard table
    const boardCards: Record<string, Map<string, number>> = {
      MAIN: new Map(), SIDE: new Map(), COMMANDER: new Map(), CONSIDERING: new Map(),
    };
    for (const dc of foundBranch.decklist.deckCards) {
      boardCards[dc.board].set(dc.cardId, dc.count);
    }
    for (const sc of workingTree.stagedChanges) {
      const board = boardCards[sc.board];
      const current = board.get(sc.cardId) ?? 0;
      if (sc.action === 'ADD') {
        board.set(sc.cardId, current + sc.count);
      } else {
        const next = current - sc.count;
        if (next <= 0) board.delete(sc.cardId);
        else board.set(sc.cardId, next);
      }
    }

    // TODO: Replace generateCommitDescription with an LLM-generated description for more natural commit messages
    const description = generateCommitDescription(
      workingTree.stagedChanges.map(sc => ({
        action: sc.action as 'ADD' | 'REMOVE',
        board: sc.board as 'MAIN' | 'SIDE' | 'COMMANDER' | 'CONSIDERING',
        count: sc.count,
        card: { name: sc.card.name },
      }))
    );

    const shouldSnapshot = (foundBranch._count.commits + 1) % 5 === 0;

    // Auto-portrait: set if deck has none
    let autoPortrait: string | null = null;
    if (!foundBranch.deck.portraitUrl) {
      const cmdCard = workingTree.stagedChanges.find(sc => sc.board === 'COMMANDER' && sc.action === 'ADD' && sc.card.artCropUrl);
      const anyCard = workingTree.stagedChanges.find(sc => sc.action === 'ADD' && sc.card.artCropUrl);
      autoPortrait = cmdCard?.card.artCropUrl ?? anyCard?.card.artCropUrl ?? null;
    }

    const snapshotDecklistId = shouldSnapshot ? randomUUID() : null;
    const snapshotId = shouldSnapshot ? randomUUID() : null;

    await prisma.$transaction(async (tx) => {
      // Re-validate session conflict at commit time (reject if another session took over)
      const freshTree = await tx.workingTree.findUnique({
        where: { id: workingTree.id },
        select: { lastSessionId: true },
      });
      if (!freshTree) throw Object.assign(new Error('WORKING_TREE_GONE'), { code: 'WT_GONE' });
      if (freshTree.lastSessionId && freshTree.lastSessionId !== sessionId) {
        throw Object.assign(new Error('SESSION_CONFLICT'), { code: 'WT_CONFLICT' });
      }

      // Create commit and promote StagedChanges to Change records
      await tx.commit.create({
        data: {
          id: newCommitId,
          description,
          branch: { connect: { id: branch } },
          changes: {
            create: workingTree.stagedChanges.map(sc => ({
              action: sc.action,
              board: sc.board,
              count: sc.count,
              card: { connect: { id: sc.cardId } },
            })),
          },
        },
      });

      // Create snapshot every 5th commit
      if (snapshotDecklistId && snapshotId) {
        await tx.decklist.create({ data: { id: snapshotDecklistId } });
        const snapshotCards = Object.entries(boardCards).flatMap(([board, cards]) =>
          [...cards.entries()].map(([cardId, count]) => ({
            decklistId: snapshotDecklistId, cardId, board: board as any, count,
          }))
        );
        if (snapshotCards.length > 0) {
          await tx.deckCard.createMany({ data: snapshotCards });
        }
        await tx.snapShot.create({
          data: { id: snapshotId, commitID: newCommitId, decklistId: snapshotDecklistId },
        });
      }

      // Update mutable deck state
      for (const [board, cards] of Object.entries(boardCards)) {
        await tx.deckCard.deleteMany({ where: { decklistId, board: board as any } });
        if (cards.size > 0) {
          await tx.deckCard.createMany({
            data: [...cards.entries()].map(([cardId, count]) => ({
              decklistId, cardId, board: board as any, count,
            })),
          });
        }
      }

      // Advance HEAD
      await tx.branch.update({ where: { id: branch }, data: { headCommitId: newCommitId } });

      if (autoPortrait) {
        await tx.deck.update({ where: { id }, data: { portraitUrl: autoPortrait } });
      }

      // Delete working tree — cascades to StagedChanges
      await tx.workingTree.delete({ where: { id: workingTree.id } });
    });

    res.status(201).json({ commitId: newCommitId, description });
  } catch (e: any) {
    if (e.code === 'WT_CONFLICT') {
      res.status(409).json({ error: 'Another session has modified this working tree. Refresh and try again.' });
      return;
    }
    if (e.code === 'WT_GONE') {
      res.status(400).json({ error: 'Working tree no longer exists' });
      return;
    }
    console.log(`Failed to quick commit: ${e.message}`);
    res.status(500).json({ error: 'Failed to commit' });
  }
});

// ── Import decklist ───────────────────────────────────────────────────────────

const importSchema = z.object({
  cards: z.array(z.object({
    name: z.string().min(1),
    count: z.number().int().min(1),
    board: z.enum(['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING']),
  })).min(1),
  description: z.string().max(200).optional(),
});

deckRouter.post("/:id/:branch/import", requireAuth, async (req: Request, res: Response) => {
  const { id, branch } = req.params;

  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { cards, description } = parsed.data;

  try {
    const foundBranch = await prisma.branch.findFirst({
      where: { id: branch, deckId: id, deck: { userEmail: req.userEmail } },
      include: {
        _count: { select: { commits: true } },
        decklist: { include: { deckCards: true } },
        workingTree: { select: { id: true } },
      },
    });

    if (!foundBranch) { res.status(404).json({ error: 'Branch not found' }); return; }

    // Look up each unique card name (case-insensitive)
    const uniqueNames = [...new Set(cards.map(c => c.name))];
    const cardLookups = await Promise.all(
      uniqueNames.map(name =>
        prisma.card.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
          select: { id: true, name: true },
        })
      )
    );

    const nameToCard = new Map<string, { id: string; name: string }>();
    const notFound: string[] = [];
    uniqueNames.forEach((name, i) => {
      if (cardLookups[i]) nameToCard.set(name.toLowerCase(), cardLookups[i]!);
      else notFound.push(name);
    });

    // Build target state from import
    const targetState: Record<string, Map<string, number>> = {
      MAIN: new Map(), SIDE: new Map(), COMMANDER: new Map(), CONSIDERING: new Map(),
    };
    for (const card of cards) {
      const found = nameToCard.get(card.name.toLowerCase());
      if (!found) continue;
      targetState[card.board].set(found.id, (targetState[card.board].get(found.id) ?? 0) + card.count);
    }

    // Build current state
    const currentState: Record<string, Map<string, number>> = {
      MAIN: new Map(), SIDE: new Map(), COMMANDER: new Map(), CONSIDERING: new Map(),
    };
    for (const dc of foundBranch.decklist.deckCards) {
      currentState[dc.board].set(dc.cardId, dc.count);
    }

    // Compute diff
    const changes: { action: 'ADD' | 'REMOVE'; board: any; cardId: string; count: number }[] = [];
    for (const board of ['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING'] as const) {
      const current = currentState[board];
      const target = targetState[board];
      current.forEach((count, cardId) => {
        const targetCount = target.get(cardId) ?? 0;
        if (targetCount < count) changes.push({ action: 'REMOVE', board, cardId, count: count - targetCount });
      });
      target.forEach((count, cardId) => {
        const currentCount = current.get(cardId) ?? 0;
        if (count > currentCount) changes.push({ action: 'ADD', board, cardId, count: count - currentCount });
      });
    }

    if (changes.length === 0) {
      res.json({ commitId: null, notFound, message: 'No changes — deck already matches import' });
      return;
    }

    const decklistId = foundBranch.decklistId;
    const workingTreeId = foundBranch.workingTree?.id;
    const newCommitId = randomUUID();
    const shouldSnapshot = (foundBranch._count.commits + 1) % 5 === 0;
    const snapshotDecklistId = shouldSnapshot ? randomUUID() : null;
    const snapshotId = shouldSnapshot ? randomUUID() : null;

    await prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id: branch },
        data: {
          commits: {
            create: {
              id: newCommitId,
              description: description?.trim() || 'Import decklist',
              changes: {
                create: changes.map(({ action, board, cardId, count }) => ({
                  action, board, count, card: { connect: { id: cardId } },
                })),
              },
            },
          },
        },
      });

      for (const [board, target] of Object.entries(targetState)) {
        await tx.deckCard.deleteMany({ where: { decklistId, board: board as any } });
        if (target.size > 0) {
          await tx.deckCard.createMany({
            data: [...target.entries()].map(([cardId, count]) => ({
              decklistId, cardId, board: board as any, count,
            })),
          });
        }
      }

      await tx.branch.update({ where: { id: branch }, data: { headCommitId: newCommitId } });

      // Snapshot every 5th commit
      if (snapshotDecklistId && snapshotId) {
        await tx.decklist.create({ data: { id: snapshotDecklistId } });
        const snapshotCards = Object.entries(targetState).flatMap(([board, cards]) =>
          [...cards.entries()].map(([cardId, count]) => ({
            decklistId: snapshotDecklistId, cardId, board: board as any, count,
          }))
        );
        if (snapshotCards.length > 0) {
          await tx.deckCard.createMany({ data: snapshotCards });
        }
        await tx.snapShot.create({
          data: { id: snapshotId, commitID: newCommitId, decklistId: snapshotDecklistId },
        });
      }

      if (workingTreeId) {
        await tx.workingTree.delete({ where: { id: workingTreeId } });
      }
    });

    res.status(201).json({ commitId: newCommitId, notFound });
  } catch (e: any) {
    console.log(`Failed to import deck: ${e.message}`);
    res.status(500).json({ error: 'Failed to import deck' });
  }
});

// ── Manual commit ────────────────────────────────────────────────────────────

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
          select: {
            id: true,
            decklistId: true,
            workingTree: { select: { id: true } },
            _count: { select: { commits: true } },
          },
        },
      },
    });

    if (foundDeck.branches.length === 0) {
      res.status(404).json({ error: "Branch not found" }); return;
    }

    const decklistId = foundDeck.branches[0].decklistId;
    const workingTreeId = foundDeck.branches[0].workingTree?.id;
    const newCommitId = randomUUID();
    const shouldSnapshot = (foundDeck.branches[0]._count.commits + 1) % 5 === 0;
    const snapshotDecklistId = shouldSnapshot ? randomUUID() : null;
    const snapshotId = shouldSnapshot ? randomUUID() : null;

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

      // Snapshot every 5th commit
      if (snapshotDecklistId && snapshotId) {
        await tx.decklist.create({ data: { id: snapshotDecklistId } });
        const snapshotCards = [
          ...([...mainCounts.entries()].map(([cardId, count]) => ({ decklistId: snapshotDecklistId, cardId, board: 'MAIN' as const, count }))),
          ...([...sideCounts.entries()].map(([cardId, count]) => ({ decklistId: snapshotDecklistId, cardId, board: 'SIDE' as const, count }))),
          ...([...commanderCounts.entries()].map(([cardId, count]) => ({ decklistId: snapshotDecklistId, cardId, board: 'COMMANDER' as const, count }))),
          ...([...consideringCounts.entries()].map(([cardId, count]) => ({ decklistId: snapshotDecklistId, cardId, board: 'CONSIDERING' as const, count }))),
        ];
        if (snapshotCards.length > 0) {
          await tx.deckCard.createMany({ data: snapshotCards });
        }
        await tx.snapShot.create({
          data: { id: snapshotId, commitID: newCommitId, decklistId: snapshotDecklistId },
        });
      }

      // Clear working tree if one exists (staged changes were committed manually)
      if (workingTreeId) {
        await tx.workingTree.delete({ where: { id: workingTreeId } });
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

    // Clean up working trees before removing branches
    const workingTrees = await prisma.workingTree.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true },
    });
    const workingTreeIds = workingTrees.map(wt => wt.id);
    if (workingTreeIds.length > 0) {
      await prisma.stagedChange.deleteMany({ where: { workingTreeId: { in: workingTreeIds } } });
      await prisma.workingTree.deleteMany({ where: { id: { in: workingTreeIds } } });
    }

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

    // Clean up working tree before removing branch
    const workingTree = await prisma.workingTree.findUnique({
      where: { branchId: branch },
      select: { id: true },
    });
    if (workingTree) {
      await prisma.stagedChange.deleteMany({ where: { workingTreeId: workingTree.id } });
      await prisma.workingTree.delete({ where: { id: workingTree.id } });
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
