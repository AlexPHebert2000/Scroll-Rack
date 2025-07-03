import express from "express";
import ViteExpress from "vite-express";
import scryfallDownload from "./helper/scryfall-download.js";
import bodyParser from "body-parser";
import api from "./api/index.js";

const app = express();

app.use(bodyParser.json());

app.use("/api", api)

app.get("/download", (_, res) => {
  scryfallDownload()
  res.sendStatus(200);
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
