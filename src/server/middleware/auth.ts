import type { Request, Response, NextFunction } from "express";
import prisma from '../db.js';

declare global {
  namespace Express {
    interface Request {
      userEmail: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies['scroll-rack-session'];
  if (!sessionId) { res.sendStatus(401); return; }

  try {
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: { expires: true, userEmail: true },
    });
    if (session.expires < new Date()) { res.sendStatus(401); return; }
    req.userEmail = session.userEmail;
    next();
  } catch {
    res.sendStatus(401);
  }
}
