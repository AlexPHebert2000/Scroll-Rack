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
    let exsistingUser = await prisma.user.findUnique({where:{email}});
    if (exsistingUser){throw new Error("Email Exists")}

    const existingUsername = await prisma.user.findUnique({where:{username}})
    if (existingUsername){throw new Error("Username Exists")}
    
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
  catch(e :any){
    
    console.log(`Error creating user : ${e.message}`);
    if (e.message == "Username Exists"){
      res.status(409).json({error: `Failed to create user: Username ${username} already exists`});
    }
    if (e.message == "Email Exists"){
      res.status(409).json({error: `Failed to create user: Email ${email} already exists`});
    }
    else{
      res.status(500).json({error : "Failed to create user"});
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
      res.cookie("scroll-rack-session", cookieId)
    }
    else { throw new Error("Incorrect Password")}
    res.sendStatus(200);
  }
  catch(e :any){
    console.log(`Failed to log in user : ${e.message}`);
    res.sendStatus(e.message === "User not found" || e.message === "Incorrect Password" ? 401 : 500);
  }
  finally{
    await prisma.$disconnect();
  }
})

userRouter.get("/profile/:username", async (req : Request, res : Response) => {
  const {username} = req.params;
  const prisma = new PrismaClient();
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
  finally{
    await prisma.$disconnect()
  }
})

userRouter.get("/session/:id", async (req: Request, res: Response) => {
  const {id} = req.params
  const prisma = new PrismaClient();
  try {
    const user = await prisma.session.findUniqueOrThrow({
      where: {id},
      select: {
        id : true,
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
    })
    res.send(user);
  }
  catch(e :any){
    console.log(`Failed to find user from session : ${e.message}`);
    res.sendStatus(500);
  }
  finally{
    await prisma.$disconnect();
  }
})

export default userRouter;