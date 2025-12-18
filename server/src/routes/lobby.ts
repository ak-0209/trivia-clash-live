import express from "express";
import { getLobby, getLeaderboard } from "../controllers/lobbyController";

const router = express.Router();

router.get("/:lobbyId", getLobby);
router.get("/:lobbyId/leaderboard", getLeaderboard);
export default router;
