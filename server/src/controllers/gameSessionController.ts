// controllers/gameSessionController.ts
import { Request, Response } from "express";
import { verify } from "jsonwebtoken";
import GameSession from "../models/GameSession";
import mongoose from "mongoose";

export const getGameSessionById = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid game session ID format",
      });
    }

    const gameSession = await GameSession.findById(sessionId).exec();

    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: "Game session not found",
      });
    }

    // Return just the leaderboard data
    return res.json({
      success: true,
      players: gameSession.players.map((p) => ({
        userId: p.userId,
        name: p.name,
        score: p.score,
        rank: p.rank,
      })),
    });
  } catch (error) {
    console.error("Error fetching game session:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
