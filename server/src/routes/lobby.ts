import express from "express";
import { getLobby } from "../controllers/lobbyController";

const router = express.Router();

router.get("/:lobbyId", getLobby);

export default router;
