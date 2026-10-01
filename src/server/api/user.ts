import { Router } from "express";
import type { Request, Response } from "express";
import prisma from '../db.js';
import bcrypt from 'bcrypt';
import { randomUUID } from "crypto";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  password: z.string().min(8),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

//Schema for PATCH /username
const changeUsernameSchema = z.object({
  newUsername: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
});

// Schema for PATCH /password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const userRouter = Router();

userRouter.post("/", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { name, email, username, password } = parsed.data;

  try {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) { res.status(409).json({ error: `Email ${email} already in use` }); return; }

    const existingUsername = await prisma.user.findUnique({ where: { username, email } });
    if (existingUsername) { res.status(409).json({ error: `Username ${username} already taken` }); return; }

    await prisma.user.create({
      data: { username, email, name, password: await bcrypt.hash(password, 10) },
    });

    res.sendStatus(201);
  } catch (e: any) {
    console.log(`Error creating user : ${e.message}`);
    res.status(500).json({ error: "Failed to create user" });
  }
})

userRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { identifier, password } = parsed.data;
  try {
    const isEmail = identifier.includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { username: identifier },
    });

    if (!user){throw new Error("User not found")}

    if (!await bcrypt.compare(password, user.password)){ throw new Error("Incorrect Password") }

    const cookieId = randomUUID();
    const expires = new Date(Date.now());
    expires.setDate(expires.getDate() + 7);

    await prisma.session.create({
      data: {
        id: cookieId,
        user: {connect: {email: user.email}},
        expires
      }
    })

    res.cookie("scroll-rack-session", cookieId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires
    })

    res.sendStatus(200);
  }
  catch(e :any){
    console.log(`Failed to log in user : ${e.message}`);
    res.sendStatus(e.message === "User not found" || e.message === "Incorrect Password" ? 401 : 500);
  }
})

userRouter.get("/me", async (req: Request, res: Response) => {
  const sessionId = req.cookies['scroll-rack-session'];
  if (!sessionId) { res.sendStatus(401); return; }

  try {
    const session = await prisma.session.findUniqueOrThrow({
      where: {id: sessionId},
      select: {
        id : true,
        expires: true,
        user: {
          select: {
            username: true,
            decks: {
              select:{
                name: true,
                id: true,
                branches:{
                  where: {
                    name: 'main'
                  },
                  select:{
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (session.expires < new Date()) {
      res.sendStatus(401); return;
    }

    const { expires, ...sessionData } = session;
    res.send(sessionData);
  }
  catch(e :any){
    console.log(`Failed to find user from session : ${e.message}`);
    res.sendStatus(e.code === 'P2025' ? 401 : 500);
  }
})

userRouter.post("/logout", async (req: Request, res: Response) => {
  const sessionId = req.cookies['scroll-rack-session'];
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
  }
  res.clearCookie('scroll-rack-session');
  res.sendStatus(200);
});

// PATCH /password
/**
 * Allows authenticated user to change their password
 * req: {currentPassword, newPassword}
 * response:
 *  400: request does not match changePassWordSchema
 *  401: Incorrect current password
 *  200: Success
 *  500: Other
 */
userRouter.patch("/password", requireAuth, async (req: Request, res: Response) => {
  // check request against changePasswordSchema
  const parsed = changePasswordSchema.safeParse(req.body);
  // if not correct, throw 400 status
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { currentPassword, newPassword } = parsed.data;

  try {
    // find user from email
    const user = await prisma.user.findUniqueOrThrow({ where: { email: req.userEmail } });
    // validate user provided correct current password
    if (!await bcrypt.compare(currentPassword, user.password)) {
      // If currentPassword is incorrect, respond 401
      res.status(401).json({ error: 'Incorrect password' }); return;
    }
    // update the user password
    await prisma.user.update({
      where: { email: req.userEmail },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });
    // send success
    res.sendStatus(200);
    // catch other errors
  } catch (e: any) {
    // log error
    console.log(`Failed to change password : ${e.message}`);
    // respond with 500
    res.status(500).json({ error: 'Failed to change password' });
  }
});
// PATCH /username
/**
 * Allows authenticated user to change their username if the username is not already taken
 * request: {newUsername}
 * response:
 * 400: if request body is poorly formed
 * 409: if username is already taken
 * 200: if successful
 * 500: other
 */
userRouter.patch("/username", requireAuth, async (req: Request, res: Response) => {
  // verify request body is properly formed
  const parsed = changeUsernameSchema.safeParse(req.body);
  // respond with 400 if not
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { newUsername } = parsed.data;

  try {
    // Look for user with the requested username
    const existing = await prisma.user.findFirst({ where: { username: newUsername } });
    // respond 409 if username is already taken
    if (existing) { res.status(409).json({ error: `Username ${newUsername} already taken` }); return; }
    //update user to new username
    await prisma.user.update({
      where: { email: req.userEmail },
      data: { username: newUsername },
    });
    // send success code
    res.sendStatus(200);
    // catch any other errors with 500 code
  } catch (e: any) {
    console.log(`Failed to change username : ${e.message}`);
    res.status(500).json({ error: 'Failed to change username' });
  }
});

userRouter.get("/profile/:username", async (req : Request, res : Response) => {
  const {username} = req.params;
  try {
    const profile = await prisma.user.findFirstOrThrow({
      where:{ username },
      omit:{
        password: true,
        updatedAt: true,
      },
      include: {
        decks: {select:{
          name: true,
          id: true
        }}
      }
    });
    res.send(profile);
  }
  catch(e :any){
    console.log(`Failed to get ${username} profile : ${e.message}`);
    if (e.code === 'P2025'){
      res.status(404).json({error : `User ${username} not found`})
    }
    else {
      res.status(500).json({error : `Failed to get ${username} profile`});
    }
  }
})

export default userRouter;
