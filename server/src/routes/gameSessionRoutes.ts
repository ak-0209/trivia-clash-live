// routes/gameSessionRoutes.ts
import express from "express";
import { getGameSessionById } from "../controllers/gameSessionController";

const router = express.Router();

// Just ONE endpoint - get game session by ID
router.get("/:sessionId", getGameSessionById);

export default router;
