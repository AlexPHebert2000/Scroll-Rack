import {Router} from "express";
import type {Request, Response} from "express";
import { PrismaClient } from "@prisma/client/extension";
import bcrypt from "bcrypt";

const userRouter = Router();

userRouter.post("/create", async (req: Request, res: Response) => {
  try{
    const {username, email, password} = req.body;
    if (!username || !email || !password) {
      res.status(400).json({error: "Username, email, and password are required"});
      return;
    }
    const prisma = new PrismaClient();
    await prisma.user.create({
      data: {
        username,
        email,
        password: await bcrypt.hash(password, 10),
      },
    })
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({error: "Internal server error"});
  }
});

export default userRouter;