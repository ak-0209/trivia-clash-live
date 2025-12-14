// routes/questionRoutes.ts
import express from "express";
import {
  getQuestionByRoundAndIndex,
  getQuestionsByRoundId,
  getTotalQuestionsByRound,
  getTotalQuestions,
  getQuestionById,
  getAllRounds,
  getRoundById,
} from "../controllers/questions";

const router = express.Router();

// Round routes
router.get("/rounds", getAllRounds);
router.get("/rounds/:id", getRoundById);

// Question routes
router.get("/round/:roundId", getQuestionsByRoundId);
router.get("/round/:roundId/index/:index", getQuestionByRoundAndIndex);
router.get("/round/:roundId/total", getTotalQuestionsByRound);

// Original routes (for backward compatibility)
router.get("/index/:index", getQuestionByRoundAndIndex); // This will need to be updated to work with rounds
router.get("/total", getTotalQuestions);
router.get("/:id", getQuestionById);

export default router;
