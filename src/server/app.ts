import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import api from "./api/index.js";

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());
app.use("/api", api);

export default app;
