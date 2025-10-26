// controllers/lobbyController.ts
import { Request, Response } from "express";
import { verify } from "jsonwebtoken";
import Lobby from "../models/lobby";

export const getLobby = async (req: Request, res: Response) => {
  try {
    const { lobbyId } = req.params;
    const authHeader = req.headers.authorization as string | undefined;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // verify token (throws if invalid)
    verify(token, process.env.JWT_SECRET || "fallback-secret");

    const lobby = await Lobby.findOne({ id: lobbyId }).exec();
    if (!lobby) {
      return res.status(404).json({ error: "Lobby not found" });
    }

    const lobbyData = {
      id: lobby.id,
      name: lobby.name,
      status: lobby.status,
      gameState: lobby.gameState,
      playerCount: Array.isArray(lobby.players) ? lobby.players.length : 0,
      currentQuestionIndex: lobby.currentQuestionIndex,
      currentQuestion: lobby.currentQuestion,
      countdown: lobby.countdown,
      host: lobby.host
        ? {
            userId: lobby.host.userId,
            name: lobby.host.name,
            isOnline: !!lobby.host.socketId,
          }
        : null,
    };

    return res.json(lobbyData);
  } catch (error) {
    console.error("Error fetching lobby:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
