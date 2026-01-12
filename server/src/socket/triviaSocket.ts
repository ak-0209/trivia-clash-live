import { Server as SocketServer, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { verify } from "jsonwebtoken";
import Lobby, { ILobby } from "../models/lobby";
import Question from "../models/question";
import Round from "../models/Round";
import mongoose from "mongoose";
import GameSession from "../models/GameSession";

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
      pingTimeout: 60000,
      pingInterval: 25000,
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
    // const roomSockets = this.io.sockets.adapter.rooms.get(lobbyId);
    // if (roomSockets) {
    //   roomSockets.forEach((socketId) => {
    //     const playerSocket = this.io.sockets.sockets.get(socketId);
    //     if (playerSocket && playerSocket.id !== socket.id) {
    //       // Don't disconnect the host
    //       playerSocket.disconnect(true); // Force disconnect
    //       console.log(`Disconnected player ${socketId} from lobby ${lobbyId}`);
    //     }
    //   });
    // }

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
  // NEW: Handle host round change with SAFETY CHECK
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

    if (!roundId) {
      console.error("Round ID is required for round change");
      return;
    }

    const existingLobby = await this.getLobby(lobbyId);
    if (!existingLobby) return;

    // ======================================================
    // 1. SAVE PROGRESS OF THE *PREVIOUS* ROUND
    // ======================================================

    // We use the DB to find what round we were just on (handles refreshes/crashes)
    const allRounds = await Round.find({}).sort({ order: 1 });
    const prevRoundIndex = existingLobby.currentRound;
    let prevRoundId: string | undefined = undefined;

    // Get the ID of the round we are leaving
    if (
      prevRoundIndex !== undefined &&
      prevRoundIndex >= 0 &&
      prevRoundIndex < allRounds.length
    ) {
      prevRoundId = allRounds[prevRoundIndex]._id.toString();
    }

    // Clone existing progress
    let updatedRoundProgress = existingLobby.roundProgress
      ? [...existingLobby.roundProgress]
      : [];

    // If we are leaving a valid round, SAVE where we stopped
    if (prevRoundId && prevRoundId !== roundId) {
      const currentIndex = existingLobby.currentQuestionIndex || 0;
      // Assume next time we start at (Current + 1)
      const nextIndexToSave = currentIndex + 1;

      const prevEntryIndex = updatedRoundProgress.findIndex(
        (p) => p.roundId === prevRoundId,
      );

      const newEntry = {
        roundId: prevRoundId,
        nextQuestionIndex: nextIndexToSave,
        isCompleted: false, // We left mid-round, so it's not complete
      };

      if (prevEntryIndex > -1) {
        // Only update if we advanced further
        if (
          updatedRoundProgress[prevEntryIndex].nextQuestionIndex <
          nextIndexToSave
        ) {
          updatedRoundProgress[prevEntryIndex] = newEntry;
        }
      } else {
        updatedRoundProgress.push(newEntry);
      }
      console.log(
        `💾 Auto-saved Round ${prevRoundIndex} (ID: ${prevRoundId}) progress at Q-${nextIndexToSave}`,
      );
    }

    // ======================================================
    // 2. CHECK & LOAD *NEW* ROUND
    // ======================================================
    const history = updatedRoundProgress.find((p) => p.roundId === roundId);

    // BLOCK if completed
    if (history?.isCompleted) {
      socket.emit("error", {
        message: `Round "${roundName}" is already completed!`,
      });
      return;
    }

    // RESUME from saved index
    const savedIndex = history ? history.nextQuestionIndex : 0;

    // ======================================================
    // 3. ACTIVATE AND UPDATE
    // ======================================================

    const isSameRound = existingLobby.currentRound === roundIndex;
    const currentRoundId = this.currentRoundIds.get(lobbyId);

    if (currentRoundId && !isSameRound) {
      await this.deactivateRound(currentRoundId);
    }

    await this.activateRound(roundId);

    this.currentRounds.set(lobbyId, roundIndex);
    this.currentRoundIds.set(lobbyId, roundId);

    const totalQuestionsInRound = await this.getTotalQuestionsInRoundById(
      roundId,
    );

    // Update DB with NEW status AND the SAVED progress array
    const updates: Partial<ILobby> = {
      currentRound: roundIndex,
      totalQuestionsInRound: totalQuestionsInRound,
      roundProgress: updatedRoundProgress, // <--- SAVES THE PREVIOUS ROUND DATA

      // If same round, stay. If new round, jump to saved index.
      currentQuestionIndex: isSameRound
        ? existingLobby.currentQuestionIndex
        : savedIndex,
      currentQuestion: isSameRound ? existingLobby.currentQuestion : null,
      status: "waiting",
      gameState: isSameRound ? existingLobby.gameState : "lobby",
    };

    await this.updateLobby(lobbyId, updates);

    this.io.to(lobbyId).emit("lobby-update", {
      type: "round-changed",
      data: {
        roundId,
        roundIndex,
        roundName,
        totalQuestionsInRound,
        currentQuestionIndex: isSameRound
          ? existingLobby.currentQuestionIndex
          : savedIndex,
        message: `Now playing: ${roundName}`,
      },
    });

    if (savedIndex > 0 && !isSameRound) {
      socket.emit("error", {
        message: `Resuming from Question ${savedIndex + 1}`,
      });
    }

    console.log(
      `Round ${roundIndex} active. Resuming at ${savedIndex}. Previous round saved.`,
    );
  }

  private async handleHostConnection(
    socket: AuthenticatedSocket,
    lobbyId: string,
  ) {
    try {
      // 1. Get from DB
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) {
        socket.emit("error", { message: "Lobby not found" });
        return;
      }

      // =========================================================
      // 🚨 CRASH RECOVERY FIX STARTS HERE 🚨
      // If memory is empty, but DB has a round, RESTORE IT TO MEMORY
      if (lobby.currentRound !== undefined && lobby.currentRound !== -1) {
        // Only set if memory doesn't have it yet
        if (!this.currentRounds.has(lobbyId)) {
          console.log(
            `♻️ Restoring Round ${lobby.currentRound} from DB to Memory`,
          );
          this.currentRounds.set(lobbyId, lobby.currentRound);
        }
      }
      // =========================================================

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
        lobby.startTime // Use DB start time for crash recovery
      ) {
        const startTime = new Date(lobby.startTime).getTime();
        const timeLimit = lobby.currentQuestion?.timeLimit || 30; // Get limit from DB question
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        remainingTime = Math.max(0, timeLimit - elapsed);

        // Restore memory maps for timer if missing
        if (!this.questionStartTimes.has(lobbyId) && remainingTime > 0) {
          this.questionStartTimes.set(lobbyId, startTime);
          this.questionTimeLimits.set(lobbyId, timeLimit);
        }
      }

      // Total rounds
      const totalRounds = await this.getTotalRounds();

      // NOW this will be correct because we restored it from DB above
      const currentRoundIndex = this.currentRounds.get(lobbyId) ?? -1;

      let currentRoundId = this.currentRoundIds.get(lobbyId);
      let totalQuestionsInRound = 0;

      // If we have a valid round index, initialize/ensure roundId and question count
      if (currentRoundIndex >= 0) {
        totalQuestionsInRound = await this.getTotalQuestionsInRoundByIndex(
          currentRoundIndex,
        );

        // If we don't yet have a roundId in memory, try to set it from DB logic
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

      // Update the lobby's host info
      // NOTE: We use currentRoundIndex here, which is now guaranteed to be correct
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

  // Inside your Socket Service / Controller
  private async joinLobby(socket: AuthenticatedSocket, lobbyId: string) {
    try {
      // 1. Fetch fresh lobby data from DB
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) {
        socket.emit("error", { message: "Failed to join lobby" });
        return;
      }

      const currentUserId = String(socket.user!._id);

      // 2. Identify existing player state to preserve scores/status
      const existingPlayer = lobby.players.find(
        (p) => String(p.userId) === currentUserId,
      );

      // 3. Kick old/duplicate connections
      if (existingPlayer?.socketId && existingPlayer.socketId !== socket.id) {
        const oldSocket = this.io.sockets.sockets.get(existingPlayer.socketId);
        if (oldSocket) {
          oldSocket.emit("force_disconnect", {
            message: "Opened in another tab.",
          });
          oldSocket.disconnect(true);
        }
      }

      // 4. Update the player list with the new socket.id
      const playerToSave = {
        userId: currentUserId,
        name: socket.user!.full_name,
        email: socket.user!.emailId,
        score: existingPlayer ? existingPlayer.score : 0,
        roundScores: existingPlayer ? existingPlayer.roundScores : [],
        joinedAt: existingPlayer ? existingPlayer.joinedAt : new Date(),
        socketId: socket.id,
        // Preserve answer status so they can't vote twice on reload
        hasAnsweredCurrentQuestion: existingPlayer
          ? existingPlayer.hasAnsweredCurrentQuestion
          : false,
        lastAnswer: existingPlayer?.lastAnswer,
      };

      const otherPlayers = lobby.players.filter(
        (p) => String(p.userId) !== currentUserId,
      );

      // Save updated player state to DB
      await this.updateLobby(lobbyId, {
        players: [...otherPlayers, playerToSave],
      });

      // 5. Join Socket Room
      socket.join(lobbyId);
      this.userLobbyMap.set(currentUserId, lobbyId);

      // 6. SYNC LOGIC: Calculate real-time countdown
      const updatedLobby = await this.getLobby(lobbyId);
      if (!updatedLobby) return;

      const isGameActive =
        updatedLobby.status === "in-progress" ||
        updatedLobby.status === "starting";
      let syncCountdown = updatedLobby.countdown;

      // If the game is live, calculate exactly how many seconds are left
      if (
        isGameActive &&
        updatedLobby.startTime &&
        updatedLobby.currentQuestion
      ) {
        const startTime = new Date(updatedLobby.startTime).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalAllowed = updatedLobby.currentQuestion.timeLimit || 30;

        // Calculate remaining time
        syncCountdown = Math.max(0, totalAllowed - elapsedSeconds);
      }

      // 7. Format and Emit Hydrated State
      const formattedLobby = this.formatLobbyForClient(updatedLobby);

      // Override the static countdown with our calculated one
      formattedLobby.countdown = syncCountdown;

      socket.emit("lobby-joined", {
        lobby: formattedLobby,
        currentQuestion: isGameActive ? updatedLobby.currentQuestion : null,
        userHasAnswered: playerToSave.hasAnsweredCurrentQuestion,
        totalRounds: updatedLobby.totalRounds || 0,
        currentRound: updatedLobby.currentRound || 0,
        totalQuestionsInRound: updatedLobby.totalQuestionsInRound || 0,
      });

      // Notify others
      socket.to(lobbyId).emit("lobby-update", {
        type: "player-joined",
        data: {
          player: {
            userId: currentUserId,
            name: socket.user!.full_name,
            score: playerToSave.score,
          },
          playerCount: updatedLobby.players.length,
        },
      });

      console.log(
        `✅ ${
          socket.user!.full_name
        } re-synced to lobby: ${lobbyId} (${syncCountdown}s left)`,
      );
    } catch (error) {
      console.error("Critical Error in joinLobby:", error);
      socket.emit("error", { message: "Internal server error during sync" });
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
  private async handleHostStreamControl(
    socket: AuthenticatedSocket,
    data: { lobbyId: string; action: string; value: any },
  ) {
    const { lobbyId, action, value } = data;

    if (action === "change_url") {
      await this.updateLobby(lobbyId, {
        streamUrl: value,
      });
    }

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

    if (!lobbyId) return;

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      if (lobby.gameState !== "question") {
        socket.emit("error", { message: "Cannot submit answer now" });
        return;
      }

      const currentQuestion = lobby.currentQuestion;
      if (!currentQuestion) return;

      // 1. Check if user already answered
      const player = lobby.players.find((p) => p.userId === userId);
      if (player?.hasAnsweredCurrentQuestion) {
        socket.emit("error", {
          message: "You have already answered this question",
        });
        return;
      }

      if (player) {
        player.hasAnsweredCurrentQuestion = true;
      }

      // 2. Validate Timer
      const questionStartTime = this.questionStartTimes.get(lobbyId);
      if (!questionStartTime) {
        socket.emit("error", {
          message: "Session sync error. Please wait for next question.",
        });
        return;
      }

      const answerTime = Date.now();
      const timeTakenSeconds = (answerTime - questionStartTime) / 1000;
      const timeLimit = currentQuestion.timeLimit || 30;

      if (timeTakenSeconds > timeLimit) {
        socket.emit("error", { message: "Time limit exceeded" });
        return;
      }

      // 3. Calculate Score
      const isCorrect = currentQuestion.correctAnswer === data.answer;
      let pointsEarned = 0;

      if (isCorrect) {
        const basePoints = currentQuestion.points || 100;
        const speedFactor = 1 - Math.pow(timeTakenSeconds / timeLimit, 2);
        pointsEarned = Math.max(
          Math.floor(basePoints * speedFactor),
          Math.floor(basePoints * 0.1),
        );
      }

      // 4. Get Current Round ID to update specific round score
      const currentRoundId = this.currentRoundIds.get(lobbyId);

      // 5. UPDATE PLAYER SCORES (Total + Round)
      const updatedPlayers = lobby.players.map((p) => {
        if (p.userId === userId) {
          const newTotalScore = p.score + pointsEarned;

          // ✅ NEW: Update Round Score
          // Initialize if undefined (migration safety)
          let currentRoundScores = p.roundScores || [];

          if (currentRoundId) {
            const roundIndex = currentRoundScores.findIndex(
              (r) => r.roundId === currentRoundId,
            );
            if (roundIndex > -1) {
              // Add to existing round score
              currentRoundScores[roundIndex].score += pointsEarned;
            } else {
              // Initialize this round
              currentRoundScores.push({
                roundId: currentRoundId,
                score: pointsEarned,
              });
            }
          }

          console.log(
            `📊 ${
              socket.user!.full_name
            }: +${pointsEarned} pts. Total: ${newTotalScore}`,
          );

          return {
            userId: p.userId,
            name: p.name,
            email: p.email,
            score: newTotalScore, // Update Total
            roundScores: currentRoundScores, // ✅ Update Round Array
            joinedAt: p.joinedAt,
            socketId: p.socketId,
            hasAnsweredCurrentQuestion: true,
            lastAnswerTime: new Date(answerTime),
            lastAnswerCorrect: isCorrect,
            lastAnswer: data.answer,
          };
        }
        return p;
      });

      const updatedLobby = await this.updateLobby(lobbyId, {
        players: updatedPlayers,
      });

      if (!updatedLobby) return;

      // 6. Emit Events
      socket.emit("answer-submitted", {
        success: true,
        isCorrect,
        pointsEarned,
        timeTaken: timeTakenSeconds.toFixed(1),
      });

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
          score: player.score,
          roundScores: player.roundScores,
          joinedAt: player.joinedAt,
          socketId: player.socketId,
          hasAnsweredCurrentQuestion: false,
          lastAnswerTime: undefined,
          lastAnswerCorrect: undefined,
          lastAnswer: undefined,
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
      this.clearLobbyTimers(lobbyId);
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) return;

      const currentRoundId = this.currentRoundIds.get(lobbyId);
      const totalQuestions = lobby.totalQuestionsInRound || 0;

      // Calculate Next Index
      const nextIndex = (lobby.currentQuestionIndex || 0) + 1;
      const isLastQuestion = nextIndex >= totalQuestions;

      // Update Progress Array in Database
      let updatedRoundProgress = lobby.roundProgress
        ? [...lobby.roundProgress]
        : [];

      if (currentRoundId) {
        const existingEntryIndex = updatedRoundProgress.findIndex(
          (p) => p.roundId === currentRoundId,
        );

        const newEntry = {
          roundId: currentRoundId,
          nextQuestionIndex: nextIndex,
          isCompleted: isLastQuestion,
        };

        if (existingEntryIndex > -1) {
          updatedRoundProgress[existingEntryIndex] = newEntry;
        } else {
          updatedRoundProgress.push(newEntry);
        }
      }

      // ==========================================================
      // 🆕 NEW: CALCULATE ANSWER ANALYTICS
      // ==========================================================
      let totalAnswered = 0;
      const choiceDistribution: Record<string, number> = {};

      const currentQuestion = lobby.currentQuestion;

      if (!currentQuestion || !currentQuestion.choices) {
        console.log("⚠️ No question data available for analytics");
      } else {
        // 1. Initialize counts to 0 for all available choices
        currentQuestion.choices.forEach((choice: string) => {
          choiceDistribution[choice] = 0;
        });

        // 2. Loop through players and count their ACTUAL selected answer
        lobby.players.forEach((player) => {
          // Only count if they answered
          if (player.hasAnsweredCurrentQuestion && player.lastAnswer) {
            // We use the stored string directly
            const answer = player.lastAnswer;

            // Increment count if it's a valid choice
            if (choiceDistribution.hasOwnProperty(answer)) {
              choiceDistribution[answer] =
                (choiceDistribution[answer] || 0) + 1;
              totalAnswered++;
            }
          }
        });

        console.log(
          `📊 Question Analytics for Q${nextIndex}:`,
          choiceDistribution,
          `Total Answers: ${totalAnswered}`,
        );
      }

      const updatedLobby = await this.updateLobby(lobbyId, {
        status: "waiting",
        gameState: "results",
        roundProgress: updatedRoundProgress, // Commit to DB
      });

      if (!updatedLobby) return;

      // Leaderboard Logic
      const leaderboard = updatedLobby.players
        .map((p) => {
          const roundEntry = p.roundScores?.find(
            (r) => r.roundId === currentRoundId,
          );
          return {
            userId: p.userId,
            name: p.name,
            score: p.score, // Total Game Score
            roundScore: roundEntry ? roundEntry.score : 0,
            lastAnswerCorrect: p.lastAnswerCorrect,
          };
        })
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          ...player,
          rank: index + 1,
        }));

      this.io.to(lobbyId).emit("lobby-update", {
        type: "question-ended",
        data: {
          correctAnswer: lobby.currentQuestion?.correctAnswer,
          leaderboard: leaderboard,
          isRoundOver: isLastQuestion,
          // 🆕 NEW: Include analytics data
          questionAnalytics: {
            totalAnswered,
            choiceDistribution,
          },
        },
      });

      console.log(
        `✅ Round ${currentRoundId} Progress Saved: Next Index ${nextIndex}`,
      );
    } catch (error) {
      console.error("Error ending question:", error);
    }
  }

  // End game
  // End game and archive data
  private async endGame(lobbyId: string) {
    try {
      const lobby = await Lobby.findOne({ id: lobbyId });
      if (!lobby) return;

      console.log(`🎮 Ending game for lobby: ${lobbyId}`);

      // 1. Prepare final scores
      const rankedPlayers = [...lobby.players]
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          userId: player.userId,
          name: player.name,
          score: player.score,
          rank: index + 1,
        }));

      // 2. Save to GameSession
      let gameSessionId = null;
      try {
        const gameSession = await GameSession.create({
          lobbyId: lobby.id,
          gameName: lobby.name,
          players: rankedPlayers,
          endedAt: new Date(),
        });
        gameSessionId = gameSession._id.toString();
        console.log(`📂 Saved game session: ${gameSessionId}`);
      } catch (error) {
        console.error("Failed to save game session:", error);
      }

      // 3. Send ALL data to frontend RIGHT NOW
      this.io.to(lobbyId).emit("lobby-update", {
        type: "game-ended",
        data: {
          leaderboard: rankedPlayers,
          gameSessionId: gameSessionId,
          lobbyName: lobby.name,
        },
      });

      console.log(`📨 Sent game-ended with ${rankedPlayers.length} players`);

      // 4. Force Disconnect Players
      const roomSockets = await this.io.in(lobbyId).fetchSockets();
      for (const s of roomSockets) {
        const authSocket = s as unknown as AuthenticatedSocket;
        if (authSocket.user) {
          this.userLobbyMap.delete(authSocket.user._id);
        }
        s.disconnect(true);
      }

      // 5. WIPE PLAYERS FROM DB
      lobby.players = [];
      lobby.status = "waiting";
      lobby.currentQuestion = null;
      lobby.currentQuestionIndex = 0;
      lobby.currentRound = -1;
      lobby.gameState = "lobby";
      lobby.roundProgress = [];

      await lobby.save();

      // =================================================================
      // CRITICAL FIX: Update the in-memory cache to match the DB reset.
      // Without this, 'getLobby' returns the OLD state (with players/scores)
      // =================================================================
      this.lobbyInstances.set(lobbyId, lobby);

      // Reset memory tracking
      this.currentRounds.set(lobbyId, -1);
      this.currentRoundIds.delete(lobbyId);
      this.clearLobbyTimers(lobbyId);

      console.log(`✅ Lobby reset and players disconnected.`);
    } catch (error) {
      console.error("Error in endGame:", error);
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
      streamUrl: lobby.streamUrl,
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
