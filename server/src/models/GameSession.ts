import mongoose, { Schema, Document, model } from "mongoose";

export interface IGameSession extends Document {
  lobbyId: string;
  gameName: string;
  hostId?: string;
  hostName?: string;
  startedAt?: Date;
  endedAt: Date;
  totalRoundsPlayed: number;

  players: Array<{
    userId: string;
    name: string;
    email: string;
    score: number;
    roundScores: Array<{
      roundId: string;
      score: number;
    }>;
    rank: number;
  }>;
}

const GameSessionSchema = new Schema(
  {
    lobbyId: { type: String, required: true, index: true },
    gameName: { type: String },
    hostId: { type: String },
    hostName: { type: String },
    endedAt: { type: Date, default: Date.now },
    totalRoundsPlayed: { type: Number, default: 0 },

    players: [
      {
        userId: { type: String },
        name: { type: String },
        email: { type: String },
        score: { type: Number },
        rank: { type: Number },
        roundScores: [
          {
            roundId: { type: String },
            score: { type: Number },
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

export default model<IGameSession>("GameSession", GameSessionSchema);
