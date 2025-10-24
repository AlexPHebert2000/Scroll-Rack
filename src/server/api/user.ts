import {Router} from "express";
import type {Request, Response} from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const userRouter = Router();

userRouter.post("/create", async (req: Request, res: Response) => {
  try{
    const prisma = new PrismaClient();
    const {name, username, email, password} = req.body;
    if (!username || !email || !password) {
      res.status(400).json({error: "Username, email, and password are required"});
      return;
    }
    await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: await bcrypt.hash(password, 10),
      },
    })
    res.sendStatus(201)
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === 'P2002'){
      res.status(409).json({error: `${req.body.email} already exists`})
    }
    else {
      res.status(500).json({error: "Internal server error"});
    }
  }
});

export default userRouter;