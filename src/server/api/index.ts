import { Router } from "express";
import scryfallRouter from "./scryfall.js";
import deckRouter from "./deck.js";
import userRouter from "./user.js";

const api = Router();
api.use("/scryfall", scryfallRouter);
api.use("/deck", deckRouter);
api.use("/user", userRouter);

export default api;
