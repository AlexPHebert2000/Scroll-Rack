import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '../../../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import { randomUUID } from "crypto";

const userRouter = Router();

userRouter.post("/", async (req : Request, res : Response) => {
  const prisma = new PrismaClient()
  const {name, email, username, password} = req.body;

  try{

    // Check for existing user using the given email
    let exsistingUser = await prisma.user.findUnique({where:{email}}) || await prisma.user.findUnique({where:{username}});
    if (exsistingUser){throw new Error("User Exists")}
    
    const user = await prisma.user.create({
      data:{
        username,
        email,
        name,
        password : await bcrypt.hash(password, 10)
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

userRouter.post("/login", async (req : Request, res : Response) => {
  const {email, password} = req.body;
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({where: {email}});
    if (!user){throw new Error("User not found")}
    if (await bcrypt.compare(password, user.password)){
      console.log(`USER ${user.email} LOGIN`);
      const cookieId = randomUUID();
      const expires = new Date(Date.now());
      expires.setDate(expires.getDate() + 7); // Cookie Expires in 7 days
      await prisma.session.create({
        data: {
          id: cookieId,
          user: {connect: {email}},
          expires
        }
      })
      res.cookie("scroll-rack-session", randomUUID(),{
        httpOnly: true,
        secure: true,
        sameSite: "strict"
      })
    }
    else { throw new Error("Incorrect Password")}
    res.sendStatus(200);
  }
  catch(e){
    console.log(e.message);
    res.sendStatus(e.message === "User not found" || e.message === "Incorrect Password" ? 401 : 500);
  }
  finally{
    await prisma.$disconnect();
  }
})

export default userRouter;