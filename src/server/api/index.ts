import { Router } from "express";
import scryfallRouter from "./scryfall.js";



const api = Router();
api.use("/scryfall", scryfallRouter);

export default api;