import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import { createHash } from "node:crypto";

const userRouter = Router();

userRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient()
  const {name, email, password} = req.body;
  try{

    // Check for existing user using the given email
    const exsistingUser = await prisma.user.findUnique({where:{ email }});
    if (exsistingUser){throw new Error("User Exists")}
    
    const user = await prisma.user.create({
      data:{
        email,
        name,
        password,
      }
    });
    
    res.sendStatus(201);
  }
  catch(e){
    console.log(e.message);
    if (e.message == "User Exists"){
      res.sendStatus(409);
    }
    else{
      res.sendStatus(500);
    }
  }
  finally{
    await prisma.$disconnect();
  }
})

export default userRouter;