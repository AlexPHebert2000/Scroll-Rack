import { Router } from "express";
import scryfallRouter from "./scryfall.js";
import userRouter from "./user.js";



const api = Router();
api.use("/scryfall", scryfallRouter);
api.use("/user", userRouter);

export default api;