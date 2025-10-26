import express from "express";
import {
  getQuestionByIndex,
  getTotalQuestions,
  getQuestionById,
} from "../controllers/questions";

const router = express.Router();

// GET /api/questions/total - Get total number of active questions
router.get("/total", getTotalQuestions);

// GET /api/questions/index/:index - Get question by position (1-based) - for players
router.get("/index/:index", getQuestionByIndex);

// GET /api/questions/:id - Get question by ID (includes correct answers) - for host
router.get("/:id", getQuestionById);

export default router;
