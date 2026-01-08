import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Tv, Trophy, User, Info, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { LobbyStreamView } from "@/components/LobbyStreamView";
import dressingroom from "@/assets/dressingroom.webp";
import { LeaderboardSidebar } from "./LeaderBoard";
import { LeaderboardCard } from "./LeaderboardList";
import { motion } from "framer-motion";

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
  const constraintsRef = useRef(null);
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
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const userDataStr = localStorage.getItem("user");
  const userData = userDataStr ? JSON.parse(userDataStr) : {};

  // Extract the ID (ensure the key matches your backend, e.g., userData.id or userData.userId)
  const currentUserId = userData.id || userData.userId; 

  // If you are in the host panel, you can determine it like this:
  const isHostPanel = !!localStorage.getItem("hostJwtToken");

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

  const totalTime = 30;
  const progress = (countdown / totalTime) * 100;

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
      />
      <div className="mx-auto max-w-7xl">
        <div className="hostpanel-header-left flex items-center justify-between relative">
          <div className="hostpanel-title leaguegothic leading-none italic text-white text-3xl">
            TRIVIA LOBBY
          </div>

          <div className="flex flex-col gap-3 relative">
            {/* Info Popup */}
            {showPopup && (
              <div 
                className="absolute top-12 right-0 w-64 p-6 rounded-3xl glassmorphism-medium border border-white/20 shadow-2xl z-50 animate-in fade-in zoom-in duration-200"
              >
                <h3 className="leaguegothic text-2xl text-white uppercase mb-4 tracking-wide">
                  Quick Info
                </h3>
                <ul className="space-y-3">
                  {[
                    "Wait for host to start questions",
                    "Answer quickly for more points",
                    "Live stream shows host content",
                    "Scores update in real-time",
                    "Game is organized into rounds"
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/90 text-sm font-medium">
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
          {/* Left Column - Stream and Info */}
          <div className="space-y-6 flex flex-col gap-4" ref={constraintsRef}>
            <motion.div 
              drag
              // Ensures the video doesn't get dragged off-screen
              dragConstraints={constraintsRef}
              dragElastic={0.1}
              dragMomentum={false}
              className="
                fixed right-4 z-50
                md:relative md:top-0 md:right-0 md:w-full md:h-auto md:z-auto
                cursor-move touch-none
              "
              // Disable dragging on desktop so it stays in the grid
              onPointerDown={(e) => {
                if (window.innerWidth >= 768) e.stopPropagation();
              }}
            >
              {/* Visual indicator that it's draggable (Mobile only) */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white/20 h-1 w-8 rounded-full md:hidden" />
              
              <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <LobbyStreamView
                  youtubeUrl={currentStreamUrl}
                  isMuted={isStreamMuted}
                />
              </div>
            </motion.div>

            <div className="h-[220px] w-full md:hidden" aria-hidden="true" />
            <div className="hidden md:block">
              {/* This is empty, just maintains grid spacing on desktop */}
            </div>

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
                    <span className="text-white/70 text-sm">Current Round:</span>
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
                            width: `${((currentRound + 1) / totalRounds) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="inter flex justify-between text-[10px] uppercase tracking-widest text-white/40 pt-1">
                        <span>Started</span>
                        <span>{totalRounds - currentRound - 1} rounds remaining</span>
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
                        ${selectedAnswer === choice 
                          ? 'bg-white/20 border-white/30 ring-1 ring-white/50' 
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'}
                      `}
                    >
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                        ${selectedAnswer === choice ? 'border-white/80 bg-white/20' : 'border-white/20'}
                      `}>
                        {selectedAnswer === choice && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-lg text-white/90 inter">{choice}</span>
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

          {/* Right Column - Players List */}
          <div className="space-y-6">
            {/* Players List */}
            <Card className="glass-panel p-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="self-stretch inline-flex flex-col items-start rounded-3xl shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-white text-lg font-medium">Main Trivia Lobby -</span>
                  <span className="text-green-500 text-lg font-semibold">{isConnected ? "Connected" : "Disconnected"}</span>
                </div>

                {/* Badges Row */}
                <div className="self-stretch flex items-center gap-3 flex-wrap">
                  {/* Waiting Badge */}
                  <div className="flex-1 shrink-0 basis-0 flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-colors px-4 py-2.5 rounded-2xl border border-white/5">
                    <div className="relative">
                      {lobbyStatus === "countdown" || lobbyStatus === "active"
                        ? `${countdown}s`
                        : 
                        <>
                          <User size={20} className="text-gray-300" />
                          <Clock size={10} className="absolute -bottom-0.5 -right-0.5 text-gray-300 bg-zinc-800 rounded-full" />
                        </>
                      }
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

            <LeaderboardCard 
              currentRoundIndex={0} 
              currentUserId={currentUserId} 
            />

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
              Question Starting In
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
                    countdown > i ? "bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]" : "bg-white/10"
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
