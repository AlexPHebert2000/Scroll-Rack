import express from "express";
import ViteExpress from "vite-express";
import scryfallDownload from "./helper/scryfall-download.js";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import api from "./api/index.js";

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.use("/api", api)

app.get("/download", (req, res) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.sendStatus(401);
  }
  scryfallDownload();
  res.sendStatus(200);
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
