import { Server as SocketServer, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { verify } from "jsonwebtoken";
import Lobby, { ILobby } from "../models/lobby";
import Question from "../models/question";
import Round from "../models/Round";
import mongoose from "mongoose";

interface AuthenticatedSocket
  extends Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> {
  user?: {
    _id: string;
    full_name: string;
    emailId: string;
    lobbyName: string;
  };
}

class TriviaSocket {
  private io: SocketServer;
  private userLobbyMap: Map<string, string> = new Map();
  private lobbyInstances: Map<string, ILobby> = new Map();
  private countdownIntervals: Map<string, NodeJS.Timeout> = new Map();
  private questionTimers: Map<string, NodeJS.Timeout> = new Map();
  private questionStartTimes: Map<string, number> = new Map();
  private questionTimeLimits: Map<string, number> = new Map();
  private currentRounds: Map<string, number> = new Map(); // Track current round for each lobby
  private currentRoundIds: Map<string, string> = new Map(); // ADD THIS: Track current round ID for each lobby

  constructor(server: any) {
    const isProduction = process.env.NODE_ENV === "production";

    // For development, allow both localhost ports
    const frontendOrigin = isProduction
      ? process.env.FRONTEND_URL
      : [
          "http://localhost:8080",
          "http://localhost:3000",
          "http://localhost:4000",
        ];

    if (isProduction && !process.env.FRONTEND_URL) {
      console.warn(
        "Warning: NODE_ENV=production but FRONTEND_URL is not set. Socket.IO CORS may be too permissive.",
      );
    }

    this.io = new SocketServer(server, {
      cors: {
        origin: frontendOrigin,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    console.log(
      "Socket.IO server created with CORS origin:",
      Array.isArray(frontendOrigin)
        ? frontendOrigin.join(", ")
        : frontendOrigin,
    );

    this.initializeSocket();
  }

  private initializeSocket() {
    this.io.use(this.authenticateToken.bind(this));
    this.io.on("connection", this.handleConnection.bind(this));
  }

  private async authenticateToken(socket: AuthenticatedSocket, next: any) {
    try {
      const token = socket.handshake.auth.token;

      console.log("Auth attempt:", {
        hasToken: !!token,
        token: token ? `${token.substring(0, 20)}...` : "none",
        lobbyName: socket.handshake.auth.lobbyName,
        isHost: socket.handshake.auth.isHost,
      });

      if (!token) {
        console.log("No token provided in handshake");
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = verify(
        token,
        process.env.JWT_SECRET || "fallback-secret",
      ) as any;

      console.log("Token decoded successfully:", {
        userId: decoded._id,
        full_name: decoded.full_name,
        emailId: decoded.emailId,
      });

      const lobbyName = socket.handshake.auth.lobbyName || "main-lobby";

      socket.user = {
        _id: decoded._id,
        full_name: decoded.full_name,
        emailId: decoded.emailId,
        lobbyName: lobbyName,
      };

      console.log("Socket user authenticated:", socket.user);
      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      next(new Error("Authentication error: Invalid token"));
    }
  }

  private async getLobby(lobbyId: string): Promise<ILobby | null> {
    if (this.lobbyInstances.has(lobbyId)) {
      return this.lobbyInstances.get(lobbyId)!;
    }

    const defaultLobbyData = {
      id: lobbyId,
      name: this.getLobbyDisplayName(lobbyId),
      maxPlayers: 1000,
      countdown: 120,
      status: "waiting" as const,
      gameState: "lobby" as const,
      players: [],
      currentRound: -1, // Change from 0 to -1 to indicate no round active
      totalRounds: 0,
      totalQuestionsInRound: 0,
    };

    try {
      let lobby = await Lobby.findOne({ id: lobbyId });
      if (!lobby) {
        lobby = await Lobby.create(defaultLobbyData);
      }
      this.lobbyInstances.set(lobbyId, lobby);
      return lobby;
    } catch (error) {
      console.error(`Error getting/creating lobby ${lobbyId}:`, error);
      return null;
    }
  }

  private getLobbyDisplayName(lobbyId: string): string {
    const lobbyDisplayNames: { [key: string]: string } = {
      "main-lobby": "Main Trivia Lobby",
      "premium-lobby": "Premium Players",
      "quick-lobby": "Quick Play",
      "partner-lobby": "Partner Arena",
      "east-coast": "East Coast Server",
      "west-coast": "West Coast Server",
    };

    return lobbyDisplayNames[lobbyId] || `${lobbyId} Lobby`;
  }

  private async updateLobby(lobbyId: string, updates: Partial<ILobby>) {
    try {
      const lobby = await Lobby.findOneAndUpdate(
        { id: lobbyId },
        { $set: updates },
        { new: true },
      );

      if (lobby) {
        this.lobbyInstances.set(lobbyId, lobby);
        return lobby;
      }
      return null;
    } catch (error) {
      console.error(`Error updating lobby ${lobbyId}:`, error);
      return null;
    }
  }

  private async handleHostStartCountdown(
    socket: AuthenticatedSocket,
    data: {
      lobbyId: string;
      countdownSeconds: number;
      questionIndex: number;
      roundId?: string;
    },
  ) {
    const { lobbyId, countdownSeconds, questionIndex, roundId } = data;
    console.log(
      `🎮 Host starting ${countdownSeconds}s countdown for question ${questionIndex} in lobby: ${lobbyId}`,
    );

    // IMPORTANT FIX: Get current round properly
    let currentRoundIndex = this.currentRounds.get(lobbyId) ?? 0;

    // If roundId is provided, ensure this round is active
    if (roundId) {
      await this.activateRound(roundId);
      // Store the round ID
      this.currentRoundIds.set(lobbyId, roundId);

      // Find the index of this round
      const rounds = await Round.find({}).sort({ order: 1 });
      const roundIndex = rounds.findIndex((r) => r._id.toString() === roundId);
      if (roundIndex >= 0) {
        currentRoundIndex = roundIndex;
        this.currentRounds.set(lobbyId, roundIndex);
      }
    } else {
      // If no roundId provided, get the current round or default to 0
      const rounds = await Round.find({}).sort({ order: 1 });
      if (currentRoundIndex < rounds.length) {
        const currentRound = rounds[currentRoundIndex];
        if (currentRound) {
          const currentRoundId = currentRound._id.toString();
          await this.activateRound(currentRoundId);
          this.currentRoundIds.set(lobbyId, currentRoundId);
        }
      }
    }

    // Clear any existing timers for this lobby
    this.clearLobbyTimers(lobbyId);

    // Update lobby status with correct round index
    await this.updateLobby(lobbyId, {
      status: "countdown",
      countdown: countdownSeconds,
      currentQuestionIndex: questionIndex,
      currentRound: currentRoundIndex, // Make sure to update current round
    });

    // Notify all players
    this.io.to(lobbyId).emit("lobby-update", {
      type: "countdown-started",
      data: {
        countdown: countdownSeconds,
        questionIndex: questionIndex,
        message: `Question ${questionIndex} starting in ${countdownSeconds} seconds`,
      },
    });

    // Start the countdown
    let currentCountdown = countdownSeconds;

    const countdownInterval = setInterval(() => {
      currentCountdown--;

      // Send countdown update to all clients
      this.io.to(lobbyId).emit("lobby-update", {
        type: "countdown",
        data: {
          countdown: currentCountdown,
          questionIndex: questionIndex,
        },
      });

      // Also send a direct countdown update event
      this.io.to(lobbyId).emit("countdown-update", {
        countdown: currentCountdown,
        questionIndex: questionIndex,
      });

      // Countdown finished - start the question
      if (currentCountdown <= 0) {
        clearInterval(countdownInterval);
        this.countdownIntervals.delete(lobbyId);
        this.startQuestion(lobbyId, questionIndex);
      }
    }, 1000);

    // Store interval for later cleanup
    this.countdownIntervals.set(lobbyId, countdownInterval);
  }

  private clearLobbyTimers(lobbyId: string) {
    // Clear countdown interval if exists
    const countdownInterval = this.countdownIntervals.get(lobbyId);
    if (countdownInterval) {
      clearInterval(countdownInterval);
      this.countdownIntervals.delete(lobbyId);
      console.log(`🧹 Cleared countdown interval for lobby: ${lobbyId}`);
    }

    // Clear question timer if exists
    const questionTimer = this.questionTimers.get(lobbyId);
    if (questionTimer) {
      clearTimeout(questionTimer);
      this.questionTimers.delete(lobbyId);
      console.log(`🧹 Cleared question timer for lobby: ${lobbyId}`);
    }
    this.questionStartTimes.delete(lobbyId);
    this.questionTimeLimits.delete(lobbyId);
  }

  // Start question immediately (no countdown)
  private async startQuestion(lobbyId: string, questionIndex: number) {
    try {
      // Clear any existing timers first
      this.clearLobbyTimers(lobbyId);

      // Reset answer tracking for new question
      await this.resetAnswerTracking(lobbyId);

      // Get current round index (default to 0 if not set)
      const currentRound = this.currentRounds.get(lobbyId) ?? 0;
      console.log(
        `🎮 Starting question ${questionIndex} in round ${currentRound}`,
      );

      const question = await this.fetchQuestionFromRound(
        currentRound,
        questionIndex,
      );

      if (!question) {
        console.error(
          `Question ${questionIndex} not found in round ${currentRound}`,
        );
        // Send an error to the host
        this.io.to(lobbyId).emit("error", {
          message: `Question ${questionIndex} not found in round ${
            currentRound + 1
          }`,
        });
        return;
      }

      const updatedLobby = await this.updateLobby(lobbyId, {
        status: "in-progress",
        gameState: "question",
        currentQuestion: question,
        currentQuestionIndex: questionIndex,
      });

      if (!updatedLobby) return;

      // Ensure time limit is from server question data
      const timeLimit = question.timeLimit || 30;

      // CRITICAL: Store start time and time limit for independent timer
      const startTime = Date.now();
      this.questionStartTimes.set(lobbyId, startTime);
      this.questionTimeLimits.set(lobbyId, timeLimit);

      // Send question to all players WITH START TIME
      this.io.to(lobbyId).emit("lobby-update", {
        type: "question-started",
        data: {
          question: question,
          timeLimit: timeLimit,
          questionIndex: questionIndex,
          startTime: startTime, // ADD THIS
          basePoints: question.points || 100, // SEND BASE POINTS TO CLIENTS
        },
      });

      // Auto-end question after SERVER time limit - STORE TIMER
      const questionTimer = setTimeout(() => {
        this.questionTimers.delete(lobbyId);
        this.questionStartTimes.delete(lobbyId); // CLEAN UP
        this.questionTimeLimits.delete(lobbyId); // CLEAN UP
        this.endQuestion(lobbyId);
      }, timeLimit * 1000);

      // STORE TIMER FOR LATER CLEANUP
      this.questionTimers.set(lobbyId, questionTimer);

      console.log(
        `Question ${questionIndex} started in lobby ${lobbyId} with ${timeLimit}s time limit (Started at: ${startTime})`,
      );
    } catch (error) {
      console.error("Error starting question:", error);
    }
  }

  private async fetchQuestionFromRound(
    roundIndex: number,
    questionIndex: number,
  ): Promise<any> {
    try {
      const rounds = await Round.find({}).sort({ order: 1 });

      console.log(
        `🔍 Fetching question: Round index ${roundIndex}, Total rounds: ${rounds.length}`,
      );

      if (roundIndex < 0 || roundIndex >= rounds.length) {
        console.error(
          `Round index ${roundIndex} out of range. Total rounds: ${rounds.length}`,
        );
        return null;
      }

      const round = rounds[roundIndex];
      const roundId = round._id;

      console.log(`✅ Found round: ${round.name} (ID: ${roundId})`);

      // FIX: Don't exclude correct answers for the host
      const roundQuestions = await Question.find({
        roundId,
        isActive: true,
      })
        .sort({ roundIndex: 1 })
        .exec(); // Remove the .select("-correctIndex -correctAnswers")

      console.log(
        `📚 Found ${roundQuestions.length} questions for round ${round.name}`,
      );

      const zeroBasedIndex = questionIndex - 1;

      if (zeroBasedIndex < 0 || zeroBasedIndex >= roundQuestions.length) {
        console.error(
          `Question index ${zeroBasedIndex} out of range. Total questions in round: ${roundQuestions.length}`,
        );
        return null;
      }

      const question = roundQuestions[zeroBasedIndex];

      // FIX: Make sure correctAnswer is properly set
      let correctAnswer = undefined;
      if (
        question.correctIndex !== undefined &&
        question.correctIndex !== null
      ) {
        correctAnswer = question.choices[question.correctIndex];
      } else if (
        question.correctAnswers &&
        question.correctAnswers.length > 0
      ) {
        // Handle multiple correct answers
        correctAnswer = question.correctAnswers
          .map((idx) => question.choices[idx])
          .join(", ");
      }

      return {
        id: question._id.toString(),
        text: question.text,
        choices: question.choices,
        correctAnswer: correctAnswer, // Make sure this is set
        timeLimit: question.timeLimit || 30,
        points: question.points || 100,
        roundId: roundId.toString(),
        roundName: round.name,
      };
    } catch (error) {
      console.error("Error fetching question from round:", error);
      return null;
    }
  }

  private async activateRound(roundId: string) {
    try {
      // Deactivate all other rounds
      await Round.updateMany({}, { $set: { isActive: false } });

      // Activate the specified round
      await Round.findByIdAndUpdate(roundId, { $set: { isActive: true } });

      console.log(`✅ Activated round: ${roundId}`);
    } catch (error) {
      console.error("Error activating round:", error);
    }
  }

  private async deactivateRound(roundId: string) {
    try {
      await Round.findByIdAndUpdate(roundId, { $set: { isActive: false } });
      console.log(`✅ Deactivated round: ${roundId}`);
    } catch (error) {
      console.error("Error deactivating round:", error);
    }
  }

  private async getTotalQuestionsInRoundByIndex(
    roundIndex: number,
  ): Promise<number> {
    try {
      // Get all rounds to find the round ID
      const rounds = await Round.find({}).sort({ order: 1 });

      if (roundIndex < 0 || roundIndex >= rounds.length) {
        return 0;
      }

      const round = rounds[roundIndex];
      const roundId = round._id;

      // Count questions for this round
      const total = await Question.countDocuments({ roundId, isActive: true });
      return total;
    } catch (error) {
      console.error("Error counting questions in round:", error);
      return 0;
    }
  }

  // Method 2: Get total questions by round ID (string)
  private async getTotalQuestionsInRoundById(roundId: string): Promise<number> {
    try {
      // Convert string to ObjectId
      const objectId = new mongoose.Types.ObjectId(roundId);

      // Count questions for this round
      const total = await Question.countDocuments({
        roundId: objectId,
        isActive: true,
      });
      return total;
    } catch (error) {
      console.error("Error counting questions in round by ID:", error);
      return 0;
    }
  }

  private async getTotalRounds(): Promise<number> {
    try {
      const count = await Round.countDocuments({});
      console.log(
        `🔢 Total rounds in database (ALL, not just active): ${count}`,
      );
      return count;
    } catch (error) {
      console.error("Error counting rounds:", error);
      return 0;
    }
  }

  private handleHostEndQuestion(socket: AuthenticatedSocket, lobbyId: string) {
    console.log(`🎮 Host ending question early for lobby: ${lobbyId}`);
    this.endQuestion(lobbyId);
  }

  // End game
  private handleHostEndGame(socket: AuthenticatedSocket, lobbyId: string) {
    console.log(`🎮 Host ending game for lobby: ${lobbyId}`);

    // NEW: Disconnect all players in this lobby
    const roomSockets = this.io.sockets.adapter.rooms.get(lobbyId);
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        const playerSocket = this.io.sockets.sockets.get(socketId);
        if (playerSocket && playerSocket.id !== socket.id) {
          // Don't disconnect the host
          playerSocket.disconnect(true); // Force disconnect
          console.log(`Disconnected player ${socketId} from lobby ${lobbyId}`);
        }
      });
    }

    this.endGame(lobbyId);
  }

  private async resetLobby(lobbyId: string) {
    try {
      await this.updateLobby(lobbyId, {
        currentRound: -1,
        totalQuestionsInRound: 0,
        currentQuestion: null,
        currentQuestionIndex: 0,
        status: "waiting",
        gameState: "lobby",
      });

      // Reset in-memory tracking
      this.currentRounds.set(lobbyId, -1);
      this.currentRoundIds.delete(lobbyId);
      this.clearLobbyTimers(lobbyId);
    } catch (error) {
      console.error("Error resetting lobby:", error);
    }
  }
  // Handle connection with host identification
  private handleConnection(socket: AuthenticatedSocket) {
    console.log(
      `User ${socket.user?.full_name} connected to lobby: ${socket.user?.lobbyName}`,
    );

    const isHost = socket.handshake.auth.isHost === true;

    if (isHost) {
      console.log(`🎮 Host ${socket.user!.full_name} connected`);
      this.handleHostConnection(socket, socket.user!.lobbyName);
    } else {
      // Regular players join their assigned lobby
      this.joinLobby(socket, socket.user!.lobbyName);
    }

    socket.on("player-ready", (isReady: boolean) => {
      this.handlePlayerReady(socket, isReady);
    });

    socket.on(
      "submit-answer",
      (data: { questionId: string; answer: string }) => {
        this.handleAnswerSubmission(socket, data);
      },
    );

    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });

    socket.on("leave-lobby", () => {
      this.leaveLobby(socket);
    });

    socket.on(
      "host-start-countdown",
      (data: {
        lobbyId: string;
        countdownSeconds: number;
        questionIndex: number;
        roundId?: string;
      }) => {
        this.handleHostStartCountdown(socket, data);
      },
    );

    socket.on(
      "host-start-question",
      (data: { lobbyId: string; questionIndex: number; roundId?: string }) => {
        this.handleHostStartQuestion(socket, data);
      },
    );

    socket.on("host-end-question", (lobbyId: string) => {
      this.handleHostEndQuestion(socket, lobbyId);
    });

    socket.on("host-end-game", (lobbyId: string) => {
      this.handleHostEndGame(socket, lobbyId);
    });

    // NEW: Handle round change
    socket.on(
      "host-change-round",
      (data: {
        lobbyId: string;
        roundId: string;
        roundIndex: number;
        roundName: string;
      }) => {
        this.handleHostChangeRound(socket, data);
      },
    );

    socket.on(
      "host-stream-control",
      (data: { lobbyId: string; action: string; value: any }) => {
        this.handleHostStreamControl(socket, data);
      },
    );
  }

  // NEW: Handle host round change
  private async handleHostChangeRound(
    socket: AuthenticatedSocket,
    data: {
      lobbyId: string;
      roundId: string;
      roundIndex: number;
      roundName: string;
    },
  ) {
    const { lobbyId, roundId, roundIndex, roundName } = data;

    // ADD NULL CHECK
    if (!roundId) {
      console.error("Round ID is required for round change");
      return;
    }

    console.log(
      `🎮 Host changing to round ${roundIndex} (${roundName}) with ID: ${roundId} in lobby: ${lobbyId}`,
    );

    // Get current round ID before changing
    const currentRoundId = this.currentRoundIds.get(lobbyId);

    // Deactivate current round if exists
    if (currentRoundId) {
      await this.deactivateRound(currentRoundId);
    }

    // Activate the new round
    await this.activateRound(roundId);

    // Update current round tracking
    this.currentRounds.set(lobbyId, roundIndex);
    this.currentRoundIds.set(lobbyId, roundId); // Now TypeScript knows roundId is not undefined

    // Get total questions in the new round
    const totalQuestionsInRound = await this.getTotalQuestionsInRoundById(
      roundId,
    );

    // Update lobby in database
    await this.updateLobby(lobbyId, {
      currentRound: roundIndex,
      totalQuestionsInRound: totalQuestionsInRound,
    });

    // Broadcast round change to all players
    this.io.to(lobbyId).emit("lobby-update", {
      type: "round-changed",
      data: {
        roundId,
        roundIndex,
        roundName,
        totalQuestionsInRound,
        message: `Now playing: ${roundName}`,
      },
    });

    console.log(
      `Round ${roundIndex} (${roundName}) activated with ${totalQuestionsInRound} questions`,
    );
  }

  // Handle host connection with state persistence
  private async handleHostConnection(
    socket: AuthenticatedSocket,
    lobbyId: string,
  ) {
    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) {
        socket.emit("error", { message: "Lobby not found" });
        return;
      }

      console.log(`🎮 Host connection attempt for lobby ${lobbyId}:`, {
        existingHost: lobby.host,
        currentStatus: lobby.status,
        currentGameState: lobby.gameState,
        currentQuestionIndex: lobby.currentQuestionIndex,
        hasActiveTimer: this.questionTimers.has(lobbyId),
      });

      const existingHost = lobby.host;
      const isNewHost = !existingHost;
      const wasGameInProgress = lobby.status !== "waiting";

      // Calculate remaining time safely
      let remainingTime = 0;
      if (
        lobby.status === "in-progress" &&
        this.questionStartTimes.has(lobbyId) &&
        this.questionTimeLimits.has(lobbyId)
      ) {
        const startTime = this.questionStartTimes.get(lobbyId)!;
        const timeLimit = this.questionTimeLimits.get(lobbyId)!;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        remainingTime = Math.max(0, timeLimit - elapsed);
        console.log(
          `⏰ Timer calculation for reconnecting host: ${timeLimit}s - ${elapsed}s = ${remainingTime}s remaining`,
        );
      }

      // Total rounds
      const totalRounds = await this.getTotalRounds();

      // Current round tracking (may be -1 when game hasn't started)
      const currentRoundIndex = this.currentRounds.get(lobbyId) ?? -1;
      let currentRoundId = this.currentRoundIds.get(lobbyId); // string | undefined
      let totalQuestionsInRound = 0;

      // If we have a valid round index, initialize/ensure roundId and question count
      if (currentRoundIndex >= 0) {
        // Use index-based API to get total questions (avoids needing an ID)
        totalQuestionsInRound = await this.getTotalQuestionsInRoundByIndex(
          currentRoundIndex,
        );

        // If we don't yet have a roundId in memory, try to set it from DB
        if (!currentRoundId) {
          const rounds = await Round.find({}).sort({ order: 1 });
          if (currentRoundIndex < rounds.length) {
            const round = rounds[currentRoundIndex];
            if (round) {
              currentRoundId = round._id.toString();
              this.currentRoundIds.set(lobbyId, currentRoundId!);
            }
          }
        }
      }

      // Update the lobby's host info and round metadata in DB
      await this.updateLobby(lobbyId, {
        host: {
          userId: socket.user!._id,
          name: socket.user!.full_name,
          email: socket.user!.emailId,
          socketId: socket.id,
          lastActive: new Date(),
        },
        totalRounds,
        currentRound: currentRoundIndex,
        totalQuestionsInRound: totalQuestionsInRound,
      });

      // Join the socket room
      socket.join(lobbyId);

      // Send current game state to host
      const updatedLobby = await this.getLobby(lobbyId);
      if (updatedLobby) {
        socket.emit("lobby-joined", {
          lobby: this.formatLobbyForClient(updatedLobby),
          isNewHost: isNewHost,
          wasGameInProgress: wasGameInProgress,
          remainingTime: remainingTime,
          totalRounds,
          currentRound: currentRoundIndex,
          totalQuestionsInRound,
          gameStarted: currentRoundIndex >= 0,
        });

        console.log(
          `🎮 Host ${
            isNewHost ? "assigned" : "reconnected"
          } to lobby ${lobbyId}`,
          {
            status: updatedLobby.status,
            gameState: updatedLobby.gameState,
            currentQuestionIndex: updatedLobby.currentQuestionIndex,
            totalRounds,
            currentRound: currentRoundIndex,
            totalQuestionsInRound,
            wasGameInProgress,
            remainingTime,
          },
        );
      }
    } catch (error) {
      console.error("Error handling host connection:", error);
      socket.emit("error", { message: "Failed to connect as host" });
    }
  }

  // Handle host disconnection
  private async handleHostDisconnection(socket: AuthenticatedSocket) {
    const lobbyId = socket.user!.lobbyName;

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby || !lobby.host) return;

      // Check if this socket was the current host
      if (lobby.host.socketId === socket.id) {
        // Update host to mark as disconnected but keep them as host
        await this.updateLobby(lobbyId, {
          host: {
            ...lobby.host,
            socketId: undefined, // Remove socket ID but keep host info
            lastActive: new Date(),
          },
        });

        console.log(
          `🎮 Host disconnected from lobby ${lobbyId}, but remains assigned`,
        );
      }
    } catch (error) {
      console.error("Error handling host disconnection:", error);
    }
  }

  // Handle disconnection for both host and players
  private handleDisconnect(socket: AuthenticatedSocket) {
    console.log(`User ${socket.user?.full_name} disconnected`);

    const wasHost = socket.handshake.auth.isHost === true;

    if (wasHost) {
      this.handleHostDisconnection(socket);
    } else {
      this.leaveLobby(socket);
    }
  }

  // Handle host start question
  private async handleHostStartQuestion(
    socket: AuthenticatedSocket,
    data: { lobbyId: string; questionIndex: number; roundId?: string },
  ) {
    const { lobbyId, questionIndex, roundId } = data;
    console.log(
      `🎮 Host starting question ${questionIndex} immediately for lobby: ${lobbyId}`,
    );

    // If roundId is provided, ensure this round is active
    if (roundId) {
      await this.activateRound(roundId);
      // Store the round ID
      this.currentRoundIds.set(lobbyId, roundId);

      // Also need to set the round index
      const rounds = await Round.find({}).sort({ order: 1 });
      const roundIndex = rounds.findIndex((r) => r._id.toString() === roundId);
      if (roundIndex >= 0) {
        this.currentRounds.set(lobbyId, roundIndex);
      }
    } else {
      // If no roundId provided, get the current round or default to 0
      const currentRoundIndex = this.currentRounds.get(lobbyId) ?? 0;
      const rounds = await Round.find({}).sort({ order: 1 });

      if (currentRoundIndex < rounds.length) {
        const currentRound = rounds[currentRoundIndex];
        if (currentRound) {
          const currentRoundId = currentRound._id.toString();
          await this.activateRound(currentRoundId);
          this.currentRoundIds.set(lobbyId, currentRoundId);
          this.currentRounds.set(lobbyId, currentRoundIndex);
        }
      }
    }

    await this.startQuestion(lobbyId, questionIndex);
  }

  private async joinLobby(socket: AuthenticatedSocket, lobbyId: string) {
    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) {
        socket.emit("error", { message: "Failed to join lobby" });
        return;
      }

      if (lobby.players.length >= lobby.maxPlayers) {
        socket.emit("error", { message: "Lobby is full" });
        return;
      }

      // Check if user already in lobby
      const existingPlayer = lobby.players.find(
        (p) => p.userId === socket.user!._id,
      );

      if (existingPlayer) {
        // FIX: Update socket ID if reconnecting - PRESERVE ALL DATA INCLUDING SCORE
        const updatedPlayers = lobby.players.map((p) =>
          p.userId === socket.user!._id
            ? {
                ...p, // Keep ALL existing data including score
                socketId: socket.id, // Only update socketId
              }
            : p,
        );

        await this.updateLobby(lobbyId, {
          players: updatedPlayers,
        });
      } else {
        // FIX: Add completely new player with score 0
        const newPlayer = {
          userId: socket.user!._id,
          name: socket.user!.full_name,
          email: socket.user!.emailId,
          score: 0, // New player starts with 0
          joinedAt: new Date(),
          socketId: socket.id,
          hasAnsweredCurrentQuestion: false,
          lastAnswerTime: undefined,
          lastAnswerCorrect: undefined,
        };

        await this.updateLobby(lobbyId, {
          players: [...lobby.players, newPlayer],
        });
      }

      // Leave previous lobby if any
      this.leaveLobby(socket);

      // Join socket room
      socket.join(lobbyId);
      this.userLobbyMap.set(socket.user!._id, lobbyId);

      // Get updated lobby data
      const updatedLobby = await this.getLobby(lobbyId);
      if (!updatedLobby) return;

      // Find the current player's data
      const currentPlayer = updatedLobby.players.find(
        (p) => p.userId === socket.user!._id,
      );

      // GET TOTAL ROUNDS AND CURRENT ROUND INFO
      const totalRounds = await this.getTotalRounds();
      const currentRoundIndex = this.currentRounds.get(lobbyId) || 0;
      let totalQuestionsInRound = 0;

      // If there's a current round, get its info
      if (currentRoundIndex >= 0) {
        totalQuestionsInRound = await this.getTotalQuestionsInRoundByIndex(
          currentRoundIndex,
        );
      }

      // Broadcast user joined to lobby
      socket.to(lobbyId).emit("lobby-update", {
        type: "player-joined",
        data: {
          player: {
            userId: socket.user!._id,
            name: socket.user!.full_name,
            score: currentPlayer?.score || 0,
          },
          playerCount: updatedLobby.players.length,
        },
      });

      // Send complete lobby state to the joining user
      socket.emit("lobby-joined", {
        lobby: this.formatLobbyForClient(updatedLobby),
        totalRounds,
        currentRound: currentRoundIndex,
        totalQuestionsInRound,
      });

      console.log(
        `User ${socket.user!.full_name} joined lobby ${lobbyId} with score: ${
          currentPlayer?.score || 0
        }`,
      );
    } catch (error) {
      console.error("Error joining lobby:", error);
      socket.emit("error", { message: "Failed to join lobby" });
    }
  }

  // Handle player ready
  private async handlePlayerReady(
    socket: AuthenticatedSocket,
    isReady: boolean,
  ) {
    const userId = socket.user!._id;
    const lobbyId = this.userLobbyMap.get(userId);

    if (!lobbyId) return;

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      // Note: Since we removed isReady, this might need to be adjusted
      // For now, we'll keep it but it won't affect anything since the field is gone
      console.log(`Player ${userId} ready state: ${isReady}`);

      // You might want to remove this event entirely or repurpose it
    } catch (error) {
      console.error("Error updating player ready status:", error);
    }
  }

  // Handle host stream control
  private handleHostStreamControl(
    socket: AuthenticatedSocket,
    data: { lobbyId: string; action: string; value: any },
  ) {
    const { lobbyId, action, value } = data;

    console.log(
      `🎮 Host stream control: ${action} = ${value} for lobby: ${lobbyId}`,
    );

    // Broadcast to ALL players in the lobby
    this.io.to(lobbyId).emit("lobby-update", {
      type: "stream-control",
      data: {
        action,
        value,
        fromHost: socket.user?.full_name,
        timestamp: Date.now(),
      },
    });
  }

  // Handle answer submission
  private async handleAnswerSubmission(
    socket: AuthenticatedSocket,
    data: { questionId: string; answer: string },
  ) {
    const userId = socket.user!._id;
    const lobbyId = this.userLobbyMap.get(userId);

    if (!lobbyId) {
      console.log(`No lobby found for user ${userId}`);
      return;
    }

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) {
        console.log(`Lobby ${lobbyId} not found`);
        return;
      }

      if (lobby.gameState !== "question") {
        console.log(
          `Game state is not 'question', current state: ${lobby.gameState}`,
        );
        socket.emit("error", { message: "Cannot submit answer now" });
        return;
      }

      const currentQuestion = lobby.currentQuestion;
      if (!currentQuestion) {
        console.log("No current question found");
        return;
      }

      // CHECK IF USER ALREADY ANSWERED THIS QUESTION
      const player = lobby.players.find((p) => p.userId === userId);
      if (player?.hasAnsweredCurrentQuestion) {
        console.log(`User ${userId} already answered this question`);
        socket.emit("error", {
          message: "You have already answered this question",
        });
        return;
      }

      // CALCULATE ANSWER TIME AND POINTS
      const questionStartTime = this.questionStartTimes.get(lobbyId);
      if (!questionStartTime) {
        console.log("No question start time found");
        return;
      }

      const answerTime = Date.now();
      const timeTakenSeconds = (answerTime - questionStartTime) / 1000;
      const timeLimit = currentQuestion.timeLimit || 30;

      // Check if answer is within time limit
      if (timeTakenSeconds > timeLimit) {
        console.log(
          `User ${userId} answered after time limit: ${timeTakenSeconds}s`,
        );
        socket.emit("error", { message: "Time limit exceeded" });
        return;
      }

      // CHECK IF ANSWER IS CORRECT
      const isCorrect = currentQuestion.correctAnswer === data.answer;

      // CALCULATE POINTS BASED ON SPEED AND CORRECTNESS
      let pointsEarned = 0;

      if (isCorrect) {
        // Base points for correct answer
        const basePoints = currentQuestion.points || 100;

        // Speed bonus: faster answers get more points
        const speedFactor = 1 - Math.pow(timeTakenSeconds / timeLimit, 2);
        pointsEarned = Math.max(
          Math.floor(basePoints * speedFactor),
          Math.floor(basePoints * 0.1), // Minimum 10% of base points for correct answer
        );

        console.log(
          `✅ ${
            socket.user!.full_name
          } answered correctly in ${timeTakenSeconds.toFixed(
            1,
          )}s: ${pointsEarned} points`,
        );
      } else {
        console.log(
          `❌ ${socket.user!.full_name} answered incorrectly: "${data.answer}"`,
        );
        pointsEarned = 0;
      }

      // UPDATE PLAYER SCORE AND MARK AS ANSWERED
      const updatedPlayers = lobby.players.map((p) => {
        if (p.userId === userId) {
          const newScore = p.score + pointsEarned;
          console.log(
            `📊 Updating ${socket.user!.full_name}'s score: ${
              p.score
            } + ${pointsEarned} = ${newScore}`,
          );
          return {
            userId: p.userId,
            name: p.name,
            email: p.email,
            score: newScore, // ADD POINTS TO EXISTING SCORE
            joinedAt: p.joinedAt,
            socketId: p.socketId,
            hasAnsweredCurrentQuestion: true,
            lastAnswerTime: new Date(answerTime),
            lastAnswerCorrect: isCorrect,
          };
        }
        return p;
      });

      const updatedLobby = await this.updateLobby(lobbyId, {
        players: updatedPlayers,
      });

      if (!updatedLobby) return;

      // Send confirmation to the player who answered
      socket.emit("answer-submitted", {
        success: true,
        isCorrect,
        pointsEarned,
        timeTaken: timeTakenSeconds.toFixed(1),
      });

      // BROADCAST SCORE UPDATE WITH MORE DETAILS
      this.io.to(lobbyId).emit("lobby-update", {
        type: "score-updated",
        data: {
          userId,
          userName: socket.user!.full_name,
          score:
            updatedLobby.players.find((p) => p.userId === userId)?.score || 0,
          pointsEarned,
          isCorrect,
          answerTime: timeTakenSeconds.toFixed(1),
          newAnswer: true,
        },
      });

      // UPDATE ANSWERED COUNT FOR HOST
      const answeredCount = updatedPlayers.filter(
        (p) => p.hasAnsweredCurrentQuestion,
      ).length;

      this.io.to(lobbyId).emit("lobby-update", {
        type: "answered-count-updated",
        data: {
          answeredCount,
          totalPlayers: updatedPlayers.length,
          waitingCount: updatedPlayers.length - answeredCount,
        },
      });

      console.log(
        `📊 Answered count: ${answeredCount}/${updatedPlayers.length}`,
      );
    } catch (error) {
      console.error("Error handling answer submission:", error);
      socket.emit("error", { message: "Failed to submit answer" });
    }
  }

  // Leave lobby
  private async leaveLobby(socket: AuthenticatedSocket) {
    const userId = socket.user!._id;
    const lobbyId = this.userLobbyMap.get(userId);

    if (!lobbyId) return;

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      // FIX: Only remove socketId, don't remove player from lobby
      const updatedPlayers = lobby.players.map((p) =>
        p.userId === userId ? { ...p, socketId: undefined } : p,
      );

      await this.updateLobby(lobbyId, {
        players: updatedPlayers,
      });

      // Leave socket room
      socket.leave(lobbyId);
      this.userLobbyMap.delete(userId);

      // Broadcast user left to lobby
      socket.to(lobbyId).emit("lobby-update", {
        type: "player-left",
        data: {
          userId,
          playerCount: updatedPlayers.length,
        },
      });

      console.log(`User ${socket.user!.full_name} left lobby ${lobbyId}`);
    } catch (error) {
      console.error("Error leaving lobby:", error);
    }
  }

  // Reset answer tracking for new questions
  private async resetAnswerTracking(lobbyId: string) {
    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      // Reset answer tracking for all players
      const resetPlayers = lobby.players.map((player) => {
        return {
          userId: player.userId,
          name: player.name,
          email: player.email,
          score: player.score, // KEEP THE SCORE - DON'T RESET IT
          joinedAt: player.joinedAt,
          socketId: player.socketId,
          hasAnsweredCurrentQuestion: false, // Only reset answer tracking
          lastAnswerTime: undefined,
          lastAnswerCorrect: undefined,
        };
      });

      await this.updateLobby(lobbyId, {
        players: resetPlayers,
      });

      console.log(
        `🔄 Reset answer tracking for all players in lobby ${lobbyId}`,
      );
    } catch (error) {
      console.error("Error resetting answer tracking:", error);
    }
  }

  // End question
  private async endQuestion(lobbyId: string) {
    try {
      // CLEAR TIMERS FIRST
      this.clearLobbyTimers(lobbyId);

      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      // CHANGED: Set gameState to "results" to show answers
      const updatedLobby = await this.updateLobby(lobbyId, {
        status: "waiting", // Keep status as waiting for next question
        gameState: "results", // Change gameState to results to show answers
      });

      if (!updatedLobby) return;

      this.io.to(lobbyId).emit("lobby-update", {
        type: "question-ended",
        data: {
          correctAnswer: lobby.currentQuestion?.correctAnswer,
          leaderboard: updatedLobby.players
            .sort((a, b) => b.score - a.score)
            .map((p) => ({
              userId: p.userId,
              name: p.name,
              score: p.score,
              lastAnswerCorrect: p.lastAnswerCorrect,
            })),
        },
      });

      console.log(`Question ended in lobby ${lobbyId}, showing results`);
    } catch (error) {
      console.error("Error ending question:", error);
    }
  }

  // End game
  private async endGame(lobbyId: string) {
    try {
      const lobby = await Lobby.findOne({ id: lobbyId });
      if (!lobby) return;

      // CRITICAL FIX: Deactivate ALL rounds when game ends
      await Round.updateMany({}, { $set: { isActive: false } });

      // Remove all players from lobby
      lobby.players = [];

      lobby.status = "waiting";
      lobby.currentQuestion = null;
      lobby.currentQuestionIndex = 0;
      lobby.currentRound = -1; // Already -1, keep it
      lobby.totalQuestionsInRound = 0;

      // FIX: Also clear host to force reconnection with fresh state
      lobby.host = undefined;

      await lobby.save();

      // Reset all round tracking
      this.currentRounds.set(lobbyId, -1); // Set to -1
      this.currentRoundIds.delete(lobbyId);

      // Clear any active timers
      this.clearLobbyTimers(lobbyId);

      // Notify all players that the game has ended and they've been removed
      this.io.to(lobbyId).emit("lobby-update", {
        type: "game-ended",
        data: {
          message: "Game ended by host",
          lobby: {
            ...lobby.toObject(),
            currentRound: -1, // Make sure this is -1
          },
        },
      });

      console.log(
        `🎮 Game ended by host, all players removed from lobby ${lobbyId}. All rounds deactivated.`,
      );
    } catch (error) {
      console.error("Error ending game:", error);
    }
  }

  // Format lobby for client
  private formatLobbyForClient(lobby: ILobby) {
    return {
      id: lobby.id,
      name: lobby.name,
      countdown: lobby.countdown,
      status: lobby.status,
      gameState: lobby.gameState,
      maxPlayers: lobby.maxPlayers,
      playerCount: lobby.players.length,
      players: lobby.players.map((p) => ({
        userId: p.userId,
        name: p.name,
        score: p.score,
        hasAnsweredCurrentQuestion: p.hasAnsweredCurrentQuestion,
        lastAnswerCorrect: p.lastAnswerCorrect,
      })),
      currentQuestion: lobby.currentQuestion,
      currentQuestionIndex: lobby.currentQuestionIndex,
      startTime: lobby.startTime,
      // Add host info
      host: lobby.host
        ? {
            userId: lobby.host.userId,
            name: lobby.host.name,
            isOnline: !!lobby.host.socketId,
          }
        : null,
      // Add round info
      totalRounds: lobby.totalRounds,
      currentRound: lobby.currentRound,
      totalQuestionsInRound: lobby.totalQuestionsInRound,
    };
  }

  public async getLobbyStats(lobbyId: string) {
    const lobby = await this.getLobby(lobbyId);
    return lobby ? this.formatLobbyForClient(lobby) : null;
  }

  public async getAllLobbies() {
    const lobbies = await Lobby.find({});
    return lobbies.map((lobby) => this.formatLobbyForClient(lobby));
  }
}

export default TriviaSocket;
