import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Clock,
  Trophy,
  User,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
// import { LobbyStreamView } from "@/components/LobbyStreamView";
import dressingroom from "@/assets/dressingroom.webp";
import { LeaderboardSidebar } from "./LeaderBoard";
import { LeaderboardCard } from "./LeaderboardList";

// Types for WebSocket data
interface LobbyUser {
  userId: string;
  name: string;
  score: number;
  hasAnsweredCurrentQuestion?: boolean;
  roundScores?: { roundId: string; score: number }[];
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
  userHasAnswered: boolean;
  streamUrl?: string;
}

const Lobby = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);
  const questionTimeLimitRef = useRef(30);

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
  // Stream disabled — no longer used
  // const [isStreamMuted, setIsStreamMuted] = useState(false);
  // const [currentStreamUrl, setCurrentStreamUrl] = useState(
  //   import.meta.env.VITE_YOUTUBE_STREAM_URL ||
  //     "https://www.youtube.com/embed/YDvsBbKfLPA",
  // );
  const [currentRoundName, setCurrentRoundName] = useState("");
  const [nextQuestionIndex, setNextQuestionIndex] = useState(0);
  const [isRoundOver, setIsRoundOver] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem("lobbyLiveLeaderboard");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const userDataStr = localStorage.getItem("user");
  const userData = userDataStr ? JSON.parse(userDataStr) : {};

  // Extract the ID (ensure the key matches your backend, e.g., userData.id or userData.userId)
  const currentUserId = userData.id || userData.userId;

  // Question timer: sync from server startTime (pre-question countdown uses socket events only)
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (lobbyStatus !== "active" || !questionStartTimeRef.current) {
      return;
    }

    const tick = () => {
      const start = questionStartTimeRef.current;
      if (!start) return;
      const limit = questionTimeLimitRef.current;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, limit - elapsed);
      setCountdown(remaining);
      if (remaining <= 0 && timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    tick();
    timerIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [lobbyStatus, currentQuestion?.id]);

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
        userHasAnswered?: boolean;
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
        updateLobbyState({
          ...data.lobby,
          userHasAnswered: data.userHasAnswered,
          totalRounds: data.totalRounds ?? data.lobby.totalRounds,
          currentRound: data.currentRound ?? data.lobby.currentRound,
          totalQuestionsInRound:
            data.totalQuestionsInRound ?? data.lobby.totalQuestionsInRound,
        });
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

  const persistLeaderboard = (lb: typeof liveLeaderboard) => {
    setLiveLeaderboard(lb);
    try {
      sessionStorage.setItem("lobbyLiveLeaderboard", JSON.stringify(lb));
    } catch {
      /* ignore */
    }
  };

  const playersToLeaderboard = (players: LobbyUser[]) =>
    [...players]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((p, index) => ({
        rank: index + 1,
        userId: p.userId,
        name: p.name,
        score: p.score || 0,
        roundScore: p.roundScores?.[0]?.score,
      }));

  const syncLeaderboardFromPlayers = (players: LobbyUser[]) => {
    if (players.length > 0) {
      persistLeaderboard(playersToLeaderboard(players));
    }
  };

  const updateLobbyState = (data: any) => {
    // 1. Extract data correctly (handling nested or flat structure)
    const lobby = data.lobby || data;
    const serverQuestion = data.currentQuestion || lobby.currentQuestion;

    const currentPlayer = lobby.players?.find(
      (p: LobbyUser) => String(p.userId) === String(currentUserId),
    );
    const userHasAnswered =
      data.userHasAnswered ??
      currentPlayer?.hasAnsweredCurrentQuestion ??
      false;

    // 2. Set Metadata
    setLobbyName(lobby.name || "Main Lobby");
    setPlayerCount(lobby.playerCount || 0);
    setLobbyUsers(lobby.players || []);
    syncLeaderboardFromPlayers(lobby.players || []);

    // Normalize status: "in-progress" -> "active"
    const normalizedStatus =
      (lobby.status === "in-progress" ? "active" : lobby.status) || "waiting";
    setLobbyStatus(normalizedStatus);

    setCurrentQuestionIndex(lobby.currentQuestionIndex || 0);

    const isQuestionLive =
      lobby.status === "in-progress" || normalizedStatus === "active";

    // 3. Rehydrate question only while a question is actually live
    if (serverQuestion && isQuestionLive) {
      console.log("Rehydrating question:", serverQuestion);
      setCurrentQuestion(serverQuestion);
      setHasAnswered(userHasAnswered);

      const timeLimit = serverQuestion.timeLimit || 30;
      questionTimeLimitRef.current = timeLimit;

      if (lobby.startTime) {
        const startMs = new Date(lobby.startTime).getTime();
        questionStartTimeRef.current = startMs;
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        setCountdown(Math.max(0, timeLimit - elapsed));
      } else if (typeof lobby.countdown === "number" && lobby.countdown > 0) {
        setCountdown(lobby.countdown);
      } else {
        setCountdown(timeLimit);
        questionStartTimeRef.current = Date.now();
      }
    } else {
      questionStartTimeRef.current = null;
      setCurrentQuestion(null);
      setHasAnswered(false);
      setCountdown(lobby.countdown || 0);
    }

    // 4. Sync Rounds
    if (data.totalRounds || lobby.totalRounds) {
      setTotalRounds(data.totalRounds || lobby.totalRounds);
    }
    if (data.currentRound !== undefined || lobby.currentRound !== undefined) {
      setCurrentRound(data.currentRound ?? lobby.currentRound);
    }
  };

  const handleLobbyUpdate = (type: string, data: any) => {
    switch (type) {
      case "countdown-started":
        questionStartTimeRef.current = null;
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
            const next = existing ? prev : [...prev, data.player];
            syncLeaderboardFromPlayers(next);
            return next;
          });
        }
        break;

      case "player-left":
        setPlayerCount(data.playerCount);
        setLobbyUsers((prev) => {
          const next = prev.filter((user) => user.userId !== data.userId);
          syncLeaderboardFromPlayers(next);
          return next;
        });
        break;

      case "score-updated":
        if (data.players?.length) {
          setLobbyUsers(data.players);
          syncLeaderboardFromPlayers(data.players);
        } else {
          setLobbyUsers((prev) => {
            const next = prev.map((user) =>
              user.userId === data.userId
                ? { ...user, score: data.score }
                : user,
            );
            syncLeaderboardFromPlayers(next);
            return next;
          });
        }
        if (data.leaderboard?.length) {
          persistLeaderboard(data.leaderboard);
        }
        break;

      case "question-started":
        setLobbyStatus("active");
        setCurrentQuestion(data.question);
        setCurrentQuestionIndex(data.questionIndex);
        setIsRoundOver(false);
        setSelectedAnswer("");
        setHasAnswered(false);

        const timeLimit = data.question?.timeLimit || data.timeLimit || 30;
        questionTimeLimitRef.current = timeLimit;
        const startMs = data.startTime || Date.now();
        questionStartTimeRef.current = startMs;
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        setCountdown(Math.max(0, timeLimit - elapsed));

        toast({
          title: "Question Started!",
          description: "Good luck!",
        });
        break;

      case "question-ended":
        questionStartTimeRef.current = null;

        setLobbyStatus("waiting");
        setCurrentQuestion(null);
        setHasAnswered(false);
        setCountdown(0);

        if (data.leaderboard?.length) {
          persistLeaderboard(data.leaderboard);
        }
        if (data.completedQuestionIndex !== undefined) {
          setCurrentQuestionIndex(data.completedQuestionIndex);
        }
        if (data.nextQuestionIndex !== undefined) {
          setNextQuestionIndex(data.nextQuestionIndex);
        }
        if (data.totalQuestionsInRound) {
          setTotalQuestionsInRound(data.totalQuestionsInRound);
        }
        if (data.currentRound !== undefined) {
          setCurrentRound(data.currentRound);
        }
        if (data.isRoundOver !== undefined) {
          setIsRoundOver(data.isRoundOver);
        }

        toast({
          title: "Question Ended",
          description: data.correctAnswer
            ? `Correct answer: ${data.correctAnswer}`
            : "See the leaderboard for updated scores.",
          duration: 8000,
        });

        if (data.isRoundOver) {
          toast({
            title: "Round complete",
            description: "Waiting for the host to start the next round.",
            duration: 10000,
          });
        }
        break;

      case "round-changed":
        questionStartTimeRef.current = null;
        setCurrentRound(data.roundIndex);
        setCurrentQuestionIndex(0);
        setNextQuestionIndex(1);
        setIsRoundOver(false);
        setTotalQuestionsInRound(data.totalQuestionsInRound);
        setCurrentRoundName(data.roundName || "");
        setCurrentQuestion(null);
        setLobbyStatus("waiting");
        setCountdown(0);
        toast({
          title: "Round Changed!",
          description: `Now playing: ${data.roundName}`,
        });
        break;

      case "game-ended":
        questionStartTimeRef.current = null;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        setLobbyStatus("waiting");
        setCountdown(0);
        setCurrentQuestion(null);
        setHasAnswered(false);

        if (data.leaderboard?.length) {
          persistLeaderboard(data.leaderboard);
        } else {
          setLiveLeaderboard([]);
          sessionStorage.removeItem("lobbyLiveLeaderboard");
        }

        const winner = data.leaderboard?.[0];
        toast({
          title: "Game Over!",
          description: winner
            ? `${winner.name} wins with ${winner.score} points`
            : "The game has ended.",
          duration: 10000,
        });
        break;

      // Stream control disabled
      // case "stream-control":
      //   break;

      case "leaderboard-cleared":
        if (data.leaderboard?.length) {
          persistLeaderboard(data.leaderboard);
          setLobbyUsers(
            data.leaderboard.map(
              (p: { userId: string; name: string; score: number }) => ({
                userId: p.userId,
                name: p.name,
                score: p.score || 0,
              }),
            ),
          );
        } else {
          setLiveLeaderboard([]);
          sessionStorage.removeItem("lobbyLiveLeaderboard");
        }
        toast({
          title: "Scores reset",
          description:
            data.message || "Leaderboard cleared for a new game",
        });
        break;

      case "lobby-reset":
        questionStartTimeRef.current = null;
        setLobbyStatus("waiting");
        setCountdown(0);
        setCurrentQuestionIndex(0);
        setCurrentRound(0);
        setLobbyUsers([]);
        setLiveLeaderboard([]);
        sessionStorage.removeItem("lobbyLiveLeaderboard");
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
    sessionStorage.removeItem("lobbyLiveLeaderboard");
    navigate("/");
  };

  const totalTime =
    currentQuestion?.timeLimit || questionTimeLimitRef.current || 30;
  const progress = totalTime > 0 ? (countdown / totalTime) * 100 : 0;

  const roundLabel =
    currentRoundName ||
    (totalRounds > 0 ? `Round ${currentRound + 1}` : "No round active");

  const questionProgressLabel = (() => {
    if (totalQuestionsInRound <= 0) return "Questions not loaded yet";
    if (lobbyStatus === "active" && currentQuestionIndex > 0) {
      return `Question ${currentQuestionIndex} of ${totalQuestionsInRound}`;
    }
    if (currentQuestionIndex > 0) {
      if (isRoundOver) {
        return `Finished ${currentQuestionIndex} of ${totalQuestionsInRound} this round`;
      }
      const next =
        nextQuestionIndex > 0
          ? nextQuestionIndex
          : currentQuestionIndex + 1;
      if (next <= totalQuestionsInRound) {
        return `Completed ${currentQuestionIndex} of ${totalQuestionsInRound} · Up next: Q${next}`;
      }
      return `Completed ${currentQuestionIndex} of ${totalQuestionsInRound}`;
    }
    return `Up next: Question 1 of ${totalQuestionsInRound}`;
  })();

  const questionProgressPercent =
    totalQuestionsInRound > 0 && currentQuestionIndex > 0
      ? (currentQuestionIndex / totalQuestionsInRound) * 100
      : 0;

  console.log(currentQuestion);

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
      <LeaderboardSidebar
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentRoundIndex={currentRound}
        liveLeaderboard={liveLeaderboard}
        currentUserId={currentUserId}
      />
      <div className="mx-auto max-w-7xl">
        <div className="hostpanel-header-left flex items-center justify-between relative">
          <div className="hostpanel-title leaguegothic leading-none italic text-white text-3xl">
            TRIVIA LOBBY
          </div>

          <div className="flex flex-col gap-3 relative">
            {/* Info Popup */}
            {showPopup && (
              <div className="absolute top-12 right-0 w-64 p-6 rounded-3xl glassmorphism-medium border border-white/20 shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
                <h3 className="leaguegothic text-2xl text-white uppercase mb-4 tracking-wide">
                  Quick Info
                </h3>
                <ul className="space-y-3">
                  {[
                    "Wait for host to start questions",
                    "Answer quickly for more points",
                    "Scores update in real-time",
                    "Game is organized into rounds",
                  ].map((text, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-white/90 text-sm font-medium"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info Button */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setShowPopup(!showPopup)}
                className="
                  flex items-center justify-center
                  rounded-full
                  bg-black/40
                  hover:bg-black/60
                  transition-colors
                  backdrop-blur-md
                  shadow-[0_8px_30px_rgba(0,0,0,0.6)]
                  ring-1 ring-white/20
                  w-10 h-10
                "
              >
                <Info className="w-5 h-5 text-white stroke-[3]" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="lobby-grid">
          {/* Left Column - Questions (stream removed) */}
          <div className="space-y-6 flex flex-col gap-4">
            {/* QUESTION OVERLAY - APPEARS WHEN ACTIVE */}
            {lobbyStatus === "active" && currentQuestion && (
              <div className="w-full max-w-2xl mx-auto p-6 glassmorphism-medium rounded-[1rem] border border-white/10 shadow-2xl text-white font-sans">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                  <h2 className="leaguegothic text-4xl italic uppercase tracking-wider">
                    Game Progress
                  </h2>

                  {/* Progress Ring */}
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: `conic-gradient(
                        rgba(255,255,255,0.9) ${progress}%,
                        rgba(255,255,255,0.15) ${progress}% 100%
                      )`,
                    }}
                  >
                    {/* Inner circle */}
                    <div className="inter w-8 h-8 rounded-full bg-black flex items-center justify-center text-xs text-white/80">
                      {countdown}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Section */}
                {/* <div className="space-y-2 mb-8">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-white/70">Current Round:</span>
                    <span className="font-bold">Round {currentRound} of {totalRounds}</span>
                  </div>
                  
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white/40 transition-all duration-500" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 pt-1">
                    <span>Started</span>
                    <span>{totalRounds - currentRound} rounds remaining</span>
                  </div>
                </div> */}

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">
                      Current Round:
                    </span>
                    <span className="inter font-bold text-white text-sm">
                      {totalRounds > 0
                        ? `Round ${currentRound + 1} of ${totalRounds}`
                        : "No Rounds Available"}
                    </span>
                  </div>

                  {totalRounds > 0 && (
                    <>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="
                            h-full
                            rounded-full
                            transition-all
                            duration-500
                            bg-gradient-to-r
                            from-red-600
                            to-orange-600
                            hover:from-red-500
                            hover:to-orange-500
                            border-none
                          "
                          style={{
                            width: `${
                              ((currentRound + 1) / totalRounds) * 100
                            }%`,
                          }}
                        />
                      </div>

                      <div className="inter flex justify-between text-[10px] uppercase tracking-widest text-white/40 pt-1">
                        <span>Started</span>
                        <span>
                          {totalRounds - currentRound - 1} rounds remaining
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Question Text */}
                <h3 className="text-xl font-medium mb-6 inter">
                  Q: {currentQuestion.text || currentQuestion.question}
                </h3>

                {/* Answer Options */}
                <div className="flex flex-col gap-3 mb-8 inter">
                  {(currentQuestion.choices || []).map((choice, index) => (
                    <button
                      key={index}
                      onClick={() => !hasAnswered && setSelectedAnswer(choice)}
                      disabled={hasAnswered}
                      className={`
                        group flex items-center gap-4 w-full p-4 rounded-full transition-all duration-200
                        ${
                          selectedAnswer === choice
                            ? "bg-white/20 border-white/30 ring-1 ring-white/50"
                            : "bg-white/5 border border-white/10 hover:bg-white/10"
                        }
                      `}
                    >
                      <div
                        className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                        ${
                          selectedAnswer === choice
                            ? "border-white/80 bg-white/20"
                            : "border-white/20"
                        }
                      `}
                      >
                        {selectedAnswer === choice && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-lg text-white/90 inter">
                        {choice}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Submit Button */}
                <button
                  onClick={() => handleAnswerSubmit(selectedAnswer)}
                  disabled={hasAnswered || !selectedAnswer}
                  className="
                    flex items-center justify-between
                    w-48 px-6 py-3 
                    bg-gradient-to-r from-[#FF3B00] to-[#FF8A00] 
                    rounded-full font-bold text-white uppercase tracking-tighter
                    hover:opacity-90 transition-opacity disabled:opacity-50
                    inter
                  "
                >
                  <span>Submit</span>
                  <ArrowUpRight className="w-5 h-5 stroke-[3]" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Progress, players, leaderboard */}
          <div className="space-y-6">
            <Card className="glassmorphism-medium p-5 border border-white/10">
              <h2 className="leaguegothic text-2xl italic uppercase tracking-wider text-white mb-4">
                Your progress
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Round</span>
                  <span className="font-bold text-white">
                    {totalRounds > 0
                      ? `${roundLabel} (${currentRound + 1} of ${totalRounds})`
                      : roundLabel}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Questions</span>
                  <span className="font-bold text-white">
                    {questionProgressLabel}
                  </span>
                </div>
                {totalQuestionsInRound > 0 && (
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-500"
                      style={{ width: `${questionProgressPercent}%` }}
                    />
                  </div>
                )}
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                  <span>
                    {lobbyStatus === "active"
                      ? "Answering now"
                      : lobbyStatus === "countdown"
                        ? "Starting soon"
                        : isRoundOver
                          ? "Round finished"
                          : "Waiting for host"}
                  </span>
                  {playerCount > 0 && (
                    <span>{playerCount} players in lobby</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Players List */}
            <Card className="glass-panel p-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="self-stretch inline-flex flex-col items-start rounded-3xl shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-white text-lg font-medium">
                    Main Trivia Lobby -
                  </span>
                  <span className="text-green-500 text-lg font-semibold">
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                {/* Badges Row */}
                <div className="self-stretch flex items-center gap-3 flex-wrap">
                  {/* Waiting Badge */}
                  <div className="flex-1 shrink-0 basis-0 flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-colors px-4 py-2.5 rounded-2xl border border-white/5">
                    <div className="relative">
                      {lobbyStatus === "countdown" ||
                      lobbyStatus === "active" ? (
                        `${countdown}s`
                      ) : (
                        <>
                          <User size={20} className="text-gray-300" />
                          <Clock
                            size={10}
                            className="absolute -bottom-0.5 -right-0.5 text-gray-300 bg-zinc-800 rounded-full"
                          />
                        </>
                      )}
                    </div>
                    <span className="text-white text-sm font-medium whitespace-nowrap">
                      {lobbyStatus === "countdown"
                        ? "Starting Soon"
                        : lobbyStatus === "active"
                        ? "Time Remaining"
                        : "Waiting for Host"}
                    </span>
                  </div>

                  {/* Others in Session Badge */}
                  <div className="flex-1 shrink-0 basis-0 flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-colors px-4 py-2.5 rounded-2xl border border-white/5">
                    <Users size={20} className="text-gray-300" />
                    <span className="text-white text-sm font-medium whitespace-nowrap">
                      {playerCount} others in session
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="text-white border-white/20"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Full leaderboard ({liveLeaderboard.length || playerCount})
                </Button>
              </div>
              <LeaderboardCard
                currentRoundIndex={currentRound}
                currentUserId={currentUserId}
                liveLeaderboard={liveLeaderboard}
              />
            </div>

            {/* Quick Info */}
            {/* <Card className="glass-panel p-6">
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
            </Card> */}
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
      {lobbyStatus === "countdown" && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          {/* Background Glow matching your gradient */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff1a00] rounded-full blur-[150px] opacity-20" />

          <div className="relative flex flex-col items-center">
            {/* Sub-header */}
            <span className="text-sm font-black uppercase tracking-[0.4em] text-slate-500 mb-2">
              {currentQuestionIndex > 0
                ? `Question ${currentQuestionIndex} · Starting in`
                : "Question Starting In"}
            </span>

            {/* Large Animated Countdown */}
            <div className="relative flex items-center justify-center">
              <span
                key={countdown} // This key ensures the animation re-runs every second
                className="text-[14rem] font-black leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent animate-in zoom-in duration-300"
              >
                {countdown}
              </span>
              <span className="absolute -right-12 bottom-10 text-4xl font-black text-[#ff7a00] italic">
                S
              </span>
            </div>

            {/* Progress Indicator */}
            <div className="mt-4 flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                    countdown > i
                      ? "bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
