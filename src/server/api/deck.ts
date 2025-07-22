import { Router } from "express";
import type { Request, Response } from "express";

const deck = Router();

type DeckCreateRequest = {
  name: string;
  description: string;
  cards: string[]; // Array of card IDs
  ownerId: string; // ID of the user creating the deck
  
};
deck.post("/create", (req :Request , res :Response) => {

})
export default deck;