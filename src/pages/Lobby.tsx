import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Tv } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { LobbyStreamView } from "@/components/LobbyStreamView";
import dressingroom from "@/assets/dressingroom.webp";

// Types for WebSocket data
interface LobbyUser {
  userId: string;
  name: string;
  score: number;
}

interface LobbyData {
  id: string;
  name: string;
  countdown: number;
  status: string;
  gameState: string;
  maxPlayers: number;
  playerCount: number;
  players: LobbyUser[];
  currentQuestion?: any;
  currentQuestionIndex?: number;
  startTime?: Date;
  totalQuestions?: number;
  totalRounds?: number;
  currentRound?: number;
  totalQuestionsInRound?: number;
  host?: {
    userId: string;
    name: string;
    isOnline: boolean;
  };
}

const Lobby = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // ADD THIS REF

  const [countdown, setCountdown] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyName, setLobbyName] = useState("Main Lobby");
  const [lobbyStatus, setLobbyStatus] = useState("waiting");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalQuestionsInRound, setTotalQuestionsInRound] = useState(0);
  const [isStreamMuted, setIsStreamMuted] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(
    import.meta.env.VITE_YOUTUBE_STREAM_URL ||
      "https://www.youtube.com/embed/YDvsBbKfLPA",
  );
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [hasAnswered, setHasAnswered] = useState(false);

  // ADD THIS: Effect to handle timer based on lobbyStatus
  useEffect(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only start timer if we're in countdown or active state
    if (
      (lobbyStatus === "active" || lobbyStatus === "countdown") &&
      countdown > 0
    ) {
      console.log(
        `Starting timer for ${lobbyStatus} with ${countdown} seconds`,
      );

      timerIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Timer reached 0, clear interval
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }

            // If countdown finished, update status
            if (lobbyStatus === "countdown") {
              setLobbyStatus("active");
            }

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [lobbyStatus]); // Re-run when lobbyStatus changes

  useEffect(() => {
    // Get user data from localStorage
    const userDataStr = localStorage.getItem("user");
    const userData = userDataStr ? JSON.parse(userDataStr) : {};

    const storedLobbyName = userData.lobbyName || "main-lobby";

    // Get JWT token
    const token =
      userData.token || localStorage.getItem("jwtToken") || userData.jwtToken;

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please sign in again",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Set lobby name for display
    setLobbyName(storedLobbyName);

    // Use import.meta.env for Vite
    const wsUrl = import.meta.env.VITE_WS_URL || "http://localhost:3000";

    // Initialize WebSocket connection with token
    const socket = io(wsUrl, {
      auth: {
        token: token,
        lobbyName: storedLobbyName,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
      toast({
        title: "Connected!",
        description: "You're now in the lobby",
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected from WebSocket:", reason);
      setIsConnected(false);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setIsConnected(false);

      if (error.message.includes("Authentication error")) {
        toast({
          title: "Authentication Failed",
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        localStorage.removeItem("jwtToken");
        localStorage.removeItem("user");
        navigate("/auth");
      } else {
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect to lobby",
          variant: "destructive",
        });
      }
    });

    // Lobby events
    socket.on(
      "lobby-joined",
      (data: {
        lobby: LobbyData;
        totalQuestions?: number;
        totalRounds?: number;
        currentRound?: number;
        totalQuestionsInRound?: number;
      }) => {
        console.log(
          "Joined lobby:",
          data.lobby,
          "Total questions:",
          data.totalQuestions,
          "Total rounds:",
          data.totalRounds,
          "Current round:",
          data.currentRound,
          "Questions in current round:",
          data.totalQuestionsInRound,
        );

        // Set total rounds from server if provided
        if (data.totalRounds) {
          setTotalRounds(data.totalRounds);
        }

        // Set current round from server if provided
        if (data.currentRound !== undefined) {
          setCurrentRound(data.currentRound);
        }

        // Set total questions in current round from server if provided
        if (data.totalQuestionsInRound) {
          setTotalQuestionsInRound(data.totalQuestionsInRound);
        }

        // Set total questions from server if provided
        if (data.totalQuestions) {
          setTotalQuestions(data.totalQuestions);
        }

        updateLobbyState(data.lobby);
        toast({
          title: `Welcome to ${data.lobby.name}!`,
          description: `There are ${data.lobby.playerCount} players in the lobby`,
        });
      },
    );

    socket.on(
      "countdown-update",
      (data: { countdown: number; questionIndex: number }) => {
        console.log("Countdown update received:", data);
        setCountdown(data.countdown);
        // Also update the question index if provided
        if (data.questionIndex !== undefined) {
          setCurrentQuestionIndex(data.questionIndex);
        }

        // Make sure to update lobby status
        if (data.countdown > 0) {
          setLobbyStatus("countdown");
        }
      },
    );

    socket.on("lobby-update", (data: { type: string; data: any }) => {
      console.log("Lobby update:", data.type, data.data);
      handleLobbyUpdate(data.type, data.data);
    });

    // Cleanup on unmount
    return () => {
      // Clear timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.emit("leave-lobby");
        socketRef.current.disconnect();
      }
    };
  }, [navigate, toast]);

  const updateLobbyState = (lobby: LobbyData) => {
    // Clear timer if exists
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setCountdown(lobby.countdown || 0);
    setPlayerCount(lobby.playerCount || 0);
    setLobbyUsers(lobby.players || []);
    setLobbyName(lobby.name || "Main Lobby");
    setLobbyStatus(lobby.status || "waiting");
    setCurrentQuestionIndex(lobby.currentQuestionIndex || 0);

    // Only set total questions from lobby if we haven't received it from server
    if (lobby.totalQuestions && totalQuestions === 0) {
      setTotalQuestions(lobby.totalQuestions);
    }

    // Only set total rounds from lobby if we haven't received it from server
    if (lobby.totalRounds && totalRounds === 0) {
      setTotalRounds(lobby.totalRounds);
    }

    // Only set current round from lobby if we haven't received it from server
    if (lobby.currentRound !== undefined && currentRound === 0) {
      setCurrentRound(lobby.currentRound);
    }

    // Only set total questions in round from lobby if we haven't received it from server
    if (lobby.totalQuestionsInRound && totalQuestionsInRound === 0) {
      setTotalQuestionsInRound(lobby.totalQuestionsInRound);
    }
  };

  const handleLobbyUpdate = (type: string, data: any) => {
    switch (type) {
      case "countdown-started":
        // Clear any existing timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("countdown");
        setCountdown(data.countdown);
        setCurrentQuestionIndex(data.questionIndex);
        toast({
          title: "Countdown Started!",
          description: `Question ${data.questionIndex} starting in ${data.countdown} seconds`,
        });
        break;

      case "countdown":
        // Update countdown value from server
        setCountdown(data.countdown);
        if (data.countdown > 0) {
          setLobbyStatus("countdown");
        }
        break;

      case "player-joined":
        setPlayerCount(data.playerCount);
        if (data.player) {
          setLobbyUsers((prev) => {
            const existing = prev.find((p) => p.userId === data.player.userId);
            if (!existing) {
              return [...prev, data.player];
            }
            return prev;
          });
        }
        break;

      case "player-left":
        setPlayerCount(data.playerCount);
        setLobbyUsers((prev) =>
          prev.filter((user) => user.userId !== data.userId),
        );
        break;

      case "score-updated":
        setLobbyUsers((prev) =>
          prev.map((user) =>
            user.userId === data.userId ? { ...user, score: data.score } : user,
          ),
        );
        break;

      case "question-started":
        // Clear any existing timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("active");
        setCurrentQuestion(data.question);
        setCurrentQuestionIndex(data.questionIndex);
        setSelectedAnswer("");
        setHasAnswered(false);
        const timeLimit = data.question?.timeLimit || data.timeLimit || 30;
        setCountdown(timeLimit);

        toast({
          title: "Question Started!",
          description: "Good luck!",
        });
        break;

      case "question-ended":
        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("waiting");
        setCurrentQuestion(null);
        setHasAnswered(false);
        setCountdown(0);
        toast({
          title: "Question Ended!",
          description: `Correct answer: ${data.correctAnswer}`,
        });
        break;

      case "round-changed":
        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setCurrentRound(data.roundIndex);
        setCurrentQuestionIndex(0);
        setTotalQuestionsInRound(data.totalQuestionsInRound);
        setCurrentQuestion(null);
        setLobbyStatus("waiting");
        setCountdown(0);
        toast({
          title: "Round Changed!",
          description: `Now playing: ${data.roundName}`,
        });
        break;

      case "game-ended":
        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("waiting");
        setCountdown(0);
        toast({
          title: "Game Over!",
          description: `Winner: ${data.winner.name} with ${data.winner.score} points`,
        });
        break;

      case "stream-control":
        if (data.action === "mute") {
          setIsStreamMuted(data.value);
        } else if (data.action === "change_url") {
          setCurrentStreamUrl(data.value);
        }
        break;

      case "lobby-reset":
        // Clear timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("waiting");
        setCountdown(0);
        setCurrentQuestionIndex(0);
        setCurrentRound(0);
        setLobbyUsers([]);
        toast({
          title: "Lobby Reset",
          description: "Lobby has been reset",
        });
        break;

      default:
        console.log("Unhandled lobby update type:", type);
    }
  };

  const handleAnswerSubmit = (answer: string) => {
    if (!socketRef.current || !currentQuestion) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);

    socketRef.current.emit("submit-answer", {
      questionId: currentQuestion.id,
      answer: answer,
    });

    toast({
      title: "Answer Submitted!",
      description: `You answered: ${answer}`,
    });
  };

  const handleLeaveLobby = () => {
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit("leave-lobby");
      socketRef.current.disconnect();
    }
    navigate("/");
  };

  const getStatusDisplay = () => {
    switch (lobbyStatus) {
      case "countdown":
        return {
          text: "⏰ COUNTDOWN",
          color: "bg-yellow-500",
          badge: "secondary",
        };
      case "active":
        return { text: "🔴 LIVE", color: "bg-red-500", badge: "default" };
      case "waiting":
      default:
        return { text: "⏹️ WAITING", color: "bg-gray-500", badge: "secondary" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      className="min-h-screen p-4 md:p-8 inter"
      style={{
        backgroundImage: `
          linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.4)),
          url(${dressingroom})
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-8xl leaguegothic uppercase text-white">
            TRIVIA LOBBY
          </h1>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Badge
              variant={statusDisplay.badge as any}
              className="text-sm text-white"
            >
              {statusDisplay.text}
            </Badge>
            <p className="text-muted-foreground text-lg text-white">
              {lobbyName} -{" "}
              <span className={isConnected ? "text-green-500" : "text-red-500"}>
                {isConnected ? "Connected" : "Connecting..."}
              </span>
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Stream and Info */}
          <div className="lg:col-span-2 space-y-6 flex flex-col gap-4">
            {/* Stream */}
            <LobbyStreamView
              youtubeUrl={currentStreamUrl}
              isMuted={isStreamMuted}
            />
            {/* QUESTION OVERLAY - APPEARS WHEN ACTIVE */}
            {lobbyStatus === "active" && currentQuestion && (
              <Card className="glassmorphism-medium border-4 shadow-xl rounded-2xl">
                <div className="p-6">
                  {/* Question Header */}
                  <div className="text-center mb-6">
                    <Badge
                      variant="secondary"
                      className="mb-3 bg-yellow-400 text-black text-lg px-4 py-2 rounded-full"
                    >
                      {totalRounds > 0
                        ? `Round ${currentRound + 1}`
                        : "No Rounds"}{" "}
                      • Question {Math.max(currentQuestionIndex, 1)} •
                      {currentQuestion?.points || 0} Points
                    </Badge>

                    <h3 className="text-2xl font-bold text-white leading-snug break-words">
                      {currentQuestion.text || currentQuestion.question}
                    </h3>

                    <div className="text-yellow-300 mt-2 font-medium">
                      ⏱ Time Limit: {currentQuestion.timeLimit}s
                    </div>
                  </div>

                  {/* Answer Buttons */}
                  <div className="flex flex-col gap-4">
                    {(
                      currentQuestion.choices ||
                      currentQuestion.options ||
                      []
                    ).map((choice: string, index: number) => (
                      <Button
                        key={index}
                        variant={
                          selectedAnswer === choice ? "default" : "outline"
                        }
                        className={`flex items-start justify-start text-left px-4 py-3 text-base sm:text-lg font-medium rounded-xl transition-all duration-200 glassmorphism-light text-white`}
                        onClick={() =>
                          !hasAnswered && handleAnswerSubmit(choice)
                        }
                        disabled={hasAnswered}
                      >
                        <span className="mr-3 font-bold text-yellow-300 flex-shrink-0">
                          {String.fromCharCode(65 + index)}.
                        </span>

                        <span className="text-white flex-1 break-all whitespace-normal leading-snug overflow-hidden text-wrap">
                          {choice}
                        </span>
                      </Button>
                    ))}
                  </div>

                  {/* Submitted Answer */}
                  {hasAnswered && (
                    <div className="text-center mt-6">
                      <Badge
                        variant="secondary"
                        className="glassmorphism-light text-white text-lg px-4 py-3 rounded-md"
                      >
                        ✅ Answer Submitted: "{selectedAnswer}"
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Game Info Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="glassmorphism-light px-6 py-6 flex flex-col gap-4">
                <Clock className="w-8 h-8 text-primary mb-3 mx-auto text-white" />
                <div className="text-center">
                  <div className="text-3xl font-black text-primary mb-1">
                    {lobbyStatus === "countdown" || lobbyStatus === "active"
                      ? `${countdown}s`
                      : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground text-white">
                    {lobbyStatus === "countdown"
                      ? "Starting Soon"
                      : lobbyStatus === "active"
                      ? "Time Remaining"
                      : "Waiting for Host"}
                  </div>
                </div>
              </Card>

              <Card className="glassmorphism-light px-6 py-6 flex flex-col gap-4">
                <Users className="w-8 h-8 text-secondary mb-3 mx-auto text-white" />
                <div className="text-center">
                  <div className="text-3xl font-black text-secondary mb-1">
                    {playerCount}
                  </div>
                  <div className="text-sm text-muted-foreground text-white">
                    Players Joined
                  </div>
                </div>
              </Card>
            </div>
            {/* Game Progress */}
            <Card className="glass-panel p-6">
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">
                Game Progress
              </h3>

              {/* Round Progress */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-white">Current Round:</span>
                  <span className="font-bold text-white">
                    {totalRounds > 0
                      ? `Round ${currentRound + 1} of ${totalRounds}`
                      : "No Rounds Available"}
                  </span>
                </div>

                {/* Only show progress bar if there are rounds */}
                {totalRounds > 0 && (
                  <>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${((currentRound + 1) / totalRounds) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span className="text-white">Started</span>
                      <span className="text-white">
                        {totalRounds - currentRound - 1} rounds remaining
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Question Progress */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white">Questions Completed:</span>
                  <span className="font-bold text-white">
                    {currentQuestionIndex} /{" "}
                    {totalQuestionsInRound > 0 ? totalQuestionsInRound : "—"}
                  </span>
                </div>

                {/* Only show progress bar if there are questions */}
                {totalQuestionsInRound > 0 && (
                  <>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (currentQuestionIndex / totalQuestionsInRound) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span className="text-white">Started</span>
                      <span className="text-white">
                        {totalQuestionsInRound - currentQuestionIndex} questions
                        remaining
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column - Players List */}
          <div className="lg:col-span-1 space-y-6">
            {/* Players List */}
            <Card className="glass-panel p-6">
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">
                Players ({playerCount})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lobbyUsers.length > 0 ? (
                  [...lobbyUsers]
                    .sort((a, b) => b.score - a.score)
                    .map((user, index) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                              index === 0
                                ? "bg-yellow-500"
                                : index === 1
                                ? "bg-gray-400"
                                : index === 2
                                ? "bg-orange-500"
                                : "bg-primary"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span className="font-medium truncate text-white">
                            {user.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono bg-background px-2 py-1 rounded text-white">
                            {user.score} pts
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-center py-8 text-white">
                    {isConnected
                      ? "Waiting for players to join..."
                      : "Connect to see players"}
                  </p>
                )}
              </div>
            </Card>

            {/* Quick Info */}
            <Card className="glass-panel p-6">
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">
                ℹ️ Quick Info
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="text-white">• Wait for host to start questions</p>
                <p className="text-white">• Answer quickly for more points</p>
                <p className="text-white">• Live stream shows host content</p>
                <p className="text-white">• Scores update in real-time</p>
                <p className="text-white">• Game is organized into rounds</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={handleLeaveLobby}
            className="text-white"
          >
            Leave Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
