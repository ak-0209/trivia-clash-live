import mongoose, { Document, Model } from "mongoose";
import { model, Schema } from "mongoose";

export interface ILobby extends Document {
  id: string;
  name: string;
  maxPlayers: number;
  countdown: number;
  status: "waiting" | "starting" | "in-progress" | "completed" | "countdown";
  gameState: "lobby" | "question" | "answer" | "results";
  currentQuestion?: any;
  currentQuestionIndex?: number;
  startTime?: Date;

  // Add these new properties for round support
  totalRounds?: number;
  currentRound?: number;
  totalQuestionsInRound?: number;

  host?: {
    userId: string;
    name: string;
    email: string;
    socketId?: string;
    lastActive: Date;
  };
  players: Array<{
    userId: string;
    name: string;
    email: string;
    score: number;
    joinedAt: Date;
    socketId?: string;
    hasAnsweredCurrentQuestion?: boolean;
    lastAnswerTime?: Date;
    lastAnswerCorrect?: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const LobbySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    maxPlayers: { type: Number, default: 1000 },
    countdown: { type: Number, default: 120 },
    status: {
      type: String,
      enum: ["waiting", "starting", "in-progress", "completed", "countdown"],
      default: "waiting",
    },
    gameState: {
      type: String,
      enum: ["lobby", "question", "answer", "results"],
      default: "lobby",
    },
    currentQuestion: { type: Schema.Types.Mixed },
    currentQuestionIndex: { type: Number },
    startTime: { type: Date },

    // Add these new fields for round support
    totalRounds: { type: Number, default: 0 },
    currentRound: { type: Number, default: 0 },
    totalQuestionsInRound: { type: Number, default: 0 },

    // Host schema
    host: {
      userId: { type: String },
      name: { type: String },
      email: { type: String },
      socketId: { type: String },
      lastActive: { type: Date, default: Date.now },
    },

    players: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        score: { type: Number, default: 0 },
        joinedAt: { type: Date, default: Date.now },
        socketId: { type: String },
        hasAnsweredCurrentQuestion: { type: Boolean, default: false },
        lastAnswerTime: { type: Date },
        lastAnswerCorrect: { type: Boolean },
      },
    ],
  },
  { timestamps: true },
);

// Create indexes for faster queries
LobbySchema.index({ id: 1 });
LobbySchema.index({ status: 1 });
LobbySchema.index({ gameState: 1 });
LobbySchema.index({ "players.userId": 1 });
LobbySchema.index({ "host.userId": 1 });

export default model<ILobby>("Lobby", LobbySchema);
