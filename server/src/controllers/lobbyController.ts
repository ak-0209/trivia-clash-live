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

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { lobbyId } = req.params;
    const { type, roundId } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;

    const authHeader = req.headers.authorization as string | undefined;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) return res.status(401).json({ error: "No token provided" });
    verify(token, process.env.JWT_SECRET || "fallback-secret");

    const lobby = await Lobby.findOne({ id: lobbyId }).exec();
    if (!lobby) return res.status(404).json({ error: "Lobby not found" });

    // ✅ SORTING LOGIC
    let sortedPlayers = [...lobby.players];

    if (type === "round" && roundId) {
      // Sort by specific Round Score
      sortedPlayers.sort((a, b) => {
        // Safe access with default empty arrays
        const scoresA = a.roundScores || [];
        const scoresB = b.roundScores || [];

        // Convert to String() to ensure ID matching works
        const scoreA =
          scoresA.find((r) => String(r.roundId) === String(roundId))?.score ||
          0;
        const scoreB =
          scoresB.find((r) => String(r.roundId) === String(roundId))?.score ||
          0;

        return scoreB - scoreA;
      });
    } else {
      // Default: Sort by Total Game Score
      sortedPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    const leaderboard = sortedPlayers.slice(0, limit).map((player, index) => {
      // Find round score if requested
      const roundEntry =
        type === "round" && roundId && player.roundScores
          ? player.roundScores.find(
              (r) => String(r.roundId) === String(roundId),
            )
          : null;

      return {
        rank: index + 1,
        userId: player.userId,
        name: player.name,
        score: player.score || 0, // Always send total
        roundScore: roundEntry ? roundEntry.score : 0, // Send round score if exists
        // Add other fields if needed by frontend
      };
    });

    return res.json({
      lobbyId: lobby.id,
      leaderboard: leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
