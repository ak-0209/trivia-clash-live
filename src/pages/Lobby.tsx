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

  const [countdown, setCountdown] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyName, setLobbyName] = useState("Main Lobby");
  const [lobbyStatus, setLobbyStatus] = useState("waiting");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStreamMuted, setIsStreamMuted] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(
    import.meta.env.VITE_YOUTUBE_STREAM_URL ||
      "https://www.youtube.com/embed/YDvsBbKfLPA",
  );
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);

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
      (data: { lobby: LobbyData; totalQuestions?: number }) => {
        console.log(
          "Joined lobby:",
          data.lobby,
          "Total questions:",
          data.totalQuestions,
        );

        // 🆕 SET TOTAL QUESTIONS FROM SERVER IF PROVIDED
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

    socket.on("lobby-update", (data: { type: string; data: any }) => {
      console.log("Lobby update:", data.type, data.data);
      handleLobbyUpdate(data.type, data.data);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-lobby");
        socketRef.current.disconnect();
      }
    };
  }, [navigate, toast]);

  const updateLobbyState = (lobby: LobbyData) => {
    setCountdown(lobby.countdown || 0);
    setPlayerCount(lobby.playerCount || 0);
    setLobbyUsers(lobby.players || []);
    setLobbyName(lobby.name || "Main Lobby");
    setLobbyStatus(lobby.status || "waiting");
    setCurrentQuestionIndex(lobby.currentQuestionIndex || 0);

    // 🆕 ONLY set totalQuestions from lobby if we haven't received it from server
    if (lobby.totalQuestions && totalQuestions === 0) {
      setTotalQuestions(lobby.totalQuestions);
    }
  };

  const handleLobbyUpdate = (type: string, data: any) => {
    switch (type) {
      case "countdown-started":
        setLobbyStatus("countdown");
        setCountdown(data.countdown);
        setCurrentQuestionIndex(data.questionIndex);
        toast({
          title: "Countdown Started!",
          description: `Question ${data.questionIndex} starting in ${data.countdown} seconds`,
        });
        break;

      case "countdown":
        setCountdown(data.countdown);
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
        setLobbyStatus("active");
        setCurrentQuestion(data.question);
        setCurrentQuestionIndex(data.questionIndex);
        setSelectedAnswer("");
        setHasAnswered(false);
        toast({
          title: "Question Started!",
          description: "Good luck!",
        });
        break;

      case "question-ended":
        setLobbyStatus("waiting");
        setCurrentQuestion(null);
        setHasAnswered(false);
        toast({
          title: "Question Ended!",
          description: `Correct answer: ${data.correctAnswer}`,
        });
        break;

      case "game-ended":
        setLobbyStatus("waiting");
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
        setLobbyStatus("waiting");
        setCountdown(0);
        setCurrentQuestionIndex(0);
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
      <div 
        className="container mx-auto max-w-7xl"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-8xl leaguegothic uppercase text-white">
            TRIVIA LOBBY
          </h1>
          <div className="flex items-center justify-center gap-4">
            <Badge variant={statusDisplay.badge as any} className="text-sm text-white">
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
          <div className="lg:col-span-2 space-y-6 flex flex-col gap-4 ">
            {/* Stream */}
            {/* Stream or Question */}
            {/* ALWAYS PLAYING STREAM - NEVER STOPS */}
            {/* STREAM - ALWAYS PLAYING, NEVER STOPS */}
            <LobbyStreamView
              youtubeUrl={currentStreamUrl}
              isMuted={isStreamMuted}
            />

            {/* QUESTION OVERLAY - APPEARS WHEN ACTIVE */}
            {lobbyStatus === "active" && currentQuestion && (
              <Card className="glass-panel border-4 border-yellow-400 bg-gradient-to-br from-blue-900 to-purple-900">
                <div className="p-6">
                  <div className="text-center mb-4">
                    <Badge
                      variant="secondary"
                      className="mb-2 bg-yellow-400 text-black text-lg"
                    >
                      Question {currentQuestionIndex} • {currentQuestion.points}{" "}
                      Points
                    </Badge>
                    <h3 className="text-2xl font-bold text-white">
                      {currentQuestion.text || currentQuestion.question}
                    </h3>
                    <div className="text-yellow-300 mt-2">
                      Time Limit: {currentQuestion.timeLimit}s
                    </div>
                  </div>

                  {/* Answer Buttons */}
                  <div className="grid grid-cols-2 gap-3">
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
                        className={`h-16 text-lg font-medium ${
                          selectedAnswer === choice
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-blue-800 hover:bg-blue-700 text-white"
                        }`}
                        onClick={() =>
                          !hasAnswered && handleAnswerSubmit(choice)
                        }
                        disabled={hasAnswered}
                      >
                        <span className="mr-2 font-bold">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        {choice}
                      </Button>
                    ))}
                  </div>

                  {hasAnswered && (
                    <div className="text-center mt-4">
                      <Badge
                        variant="secondary"
                        className="bg-green-600 text-white text-lg px-4 py-2"
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
                    {lobbyStatus === "countdown" ? `${countdown}s` : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground text-white">
                    {lobbyStatus === "countdown"
                      ? "Starting Soon"
                      : lobbyStatus === "active"
                      ? "Question Active"
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
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">Game Progress</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Questions Completed:</span>
                  <span className="font-bold text-lg">
                    {currentQuestionIndex} / {totalQuestions || "?"}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        totalQuestions > 0
                          ? (currentQuestionIndex / totalQuestions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Started</span>
                  <span>
                    {totalQuestions > 0
                      ? totalQuestions - currentQuestionIndex
                      : "?"}{" "}
                    questions remaining
                  </span>
                </div>
              </div>
            </Card>

            {/* Game Status */}
            <Card className="glass-panel p-6">
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">Game Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Current Status:</span>
                  <Badge variant={statusDisplay.badge as any}>
                    {statusDisplay.text}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <Badge variant={isConnected ? "default" : "destructive"}>
                    {isConnected ? "🟢 CONNECTED" : "🔴 DISCONNECTED"}
                  </Badge>
                </div>
                {lobbyStatus === "countdown" && (
                  <div className="flex justify-between">
                    <span>Next Question:</span>
                    <span className="font-bold">
                      #{currentQuestionIndex + 1}
                    </span>
                  </div>
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
                          <span className="font-medium truncate">
                            {user.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono bg-background px-2 py-1 rounded">
                            {user.score} pts
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    {isConnected
                      ? "Waiting for players to join..."
                      : "Connect to see players"}
                  </p>
                )}
              </div>
            </Card>

            {/* Quick Info */}
            <Card className="glass-panel p-6">
              <h3 className="text-4xl leaguegothic uppercase text-white mb-4">ℹ️ Quick Info</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>• Wait for host to start questions</p>
                <p>• Answer quickly for more points</p>
                <p>• Live stream shows host content</p>
                <p>• Scores update in real-time</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <Button variant="outline" size="lg" onClick={handleLeaveLobby}>
            Leave Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
