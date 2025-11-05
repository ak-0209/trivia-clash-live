import express from "express";
import { getLobby, getLeaderboard } from "../controllers/lobbyController";

const router = express.Router();

router.get("/:lobbyId", getLobby);
router.get("/leaderboard/:lobbyId", getLeaderboard);

export default router;
