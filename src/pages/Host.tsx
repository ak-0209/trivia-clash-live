import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipForward,
  Users,
  CheckCircle2,
  Clock,
  X,
  List,
  Trophy,
  ArrowUpRight,
  Shuffle,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StreamView from "@/components/StreamView";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Volume2, VolumeX, RefreshCw, Radio } from "lucide-react";
import dressingroom from "@/assets/dressingroom.webp";
import { LeaderboardSidebar } from "./LeaderBoard";
import { LeaderboardCard } from "./LeaderboardList";
// Types for rounds
interface Round {
  id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export function joinUrl(base: string, path: string) {
  const _base = base.replace(/\/+$/, "");
  const _path = path.replace(/^\/+/, "");
  return _base ? `${_base}/${_path}` : `/${_path}`;
}

const Host = () => {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  const [gameStatus, setGameStatus] = useState<
    "waiting" | "countdown" | "active" | "paused" | "results"
  >("waiting");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentRound, setCurrentRound] = useState(-1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalQuestionsInRound, setTotalQuestionsInRound] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [currentQuestionData, setCurrentQuestionData] = useState<any>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [showRoundSelector, setShowRoundSelector] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Modal state
  const [showStartModal, setShowStartModal] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamMuted, setIsStreamMuted] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(
    import.meta.env.VITE_YOUTUBE_STREAM_URL ||
      "https://www.youtube.com/embed/YDvsBbKfLPA",
  );
  const [roundsLoaded, setRoundsLoaded] = useState(false);

  const userDataStr = localStorage.getItem("user");
  const userData = userDataStr ? JSON.parse(userDataStr) : {};

  // Extract the ID (ensure the key matches your backend, e.g., userData.id or userData.userId)
  const currentUserId = userData.id || userData.userId; 

  // If you are in the host panel, you can determine it like this:
  const isHostPanel = !!localStorage.getItem("hostJwtToken");

  const API_BASE = import.meta.env.VITE_API_URL;

  // Connect to WebSocket and restore state
  useEffect(() => {
    const token = localStorage.getItem("hostJwtToken");
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please sign in again",
        variant: "destructive",
      });
      return;
    }

    const socket = io(import.meta.env.VITE_WS_URL || "http://localhost:3000", {
      auth: {
        token: token,
        lobbyName: "main-lobby",
        isHost: true,
      },
      // Add reconnection options
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Host connected to WebSocket");
      setIsConnected(true);
      toast({
        title: "Host Connected",
        description: "You're now controlling the game",
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Host disconnected from WebSocket");
    });

    // Listen for lobby-joined event to restore state
    socket.on(
      "lobby-joined",
      (data: {
        lobby: any;
        isNewHost: boolean;
        wasGameInProgress: boolean;
        remainingTime?: number;
        totalQuestions?: number;
        totalRounds?: number; // New field for rounds
        currentRound?: number; // New field for current round
        totalQuestionsInRound?: number; // New field for questions in current round
      }) => {
        console.log("Host received lobby-joined:", data);

        const {
          lobby,
          wasGameInProgress,
          remainingTime,
          totalQuestions,
          totalRounds,
          currentRound,
          totalQuestionsInRound,
        } = data;

        if (totalRounds) {
          setTotalRounds(totalRounds);
        }

        // Set current round from server
        if (currentRound !== undefined) {
          setCurrentRound(currentRound);

          if (currentRound >= 0) {
            setGameStarted(true);
          }
        }

        // Set total questions in current round from server
        if (totalQuestionsInRound) {
          setTotalQuestionsInRound(totalQuestionsInRound);
        }

        // Set total questions from server
        if (totalQuestions) {
          setTotalQuestions(totalQuestions);
        }

        // Always restore game state from server
        if (lobby) {
          setPlayerCount(lobby.playerCount || 0);
          setCurrentQuestion(lobby.currentQuestionIndex || 0);

          // Only set total questions if not already set from data
          if (!totalQuestions) {
            setTotalQuestions(lobby.totalQuestions || 10);
          }

          // Restore current question data
          if (lobby.currentQuestion) {
            setCurrentQuestionData(lobby.currentQuestion);
          }

          // Updated status mapping with timer state consideration
          if (lobby.status === "countdown") {
            setGameStatus("countdown");
            setCountdown(lobby.countdown || 0);
          } else if (lobby.status === "in-progress") {
            setGameStatus("active");

            // Use actual remaining time from server, not full time
            if (remainingTime && remainingTime > 0) {
              setCountdown(remainingTime);
              console.log(
                `⏰ Restored actual remaining time: ${remainingTime}s`,
              );

              toast({
                title: "Timer Continued",
                description: `Question timer kept running: ${remainingTime}s remaining`,
              });
            } else if (lobby.currentQuestion) {
              // Fallback to full time limit if no remaining time
              setCountdown(lobby.currentQuestion.timeLimit || 30);
            }
          } else {
            setGameStatus("waiting");
          }

          // Show toast for state restoration
          if (wasGameInProgress) {
            toast({
              title: "Game State Restored",
              description: `Resumed from round ${currentRound || 0}, question ${
                lobby.currentQuestionIndex || 0
              }`,
            });
          }
        }
      },
    );

    socket.on("lobby-update", (data: { type: string; data: any }) => {
      console.log("Host received update:", data.type, data.data);

      // Add stream control updates
      if (data.type === "stream-control") {
        if (data.data.action === "mute") {
          setIsStreamMuted(data.data.value);
        } else if (data.data.action === "change_url") {
          setCurrentStreamUrl(data.data.value);
        }
      }

      handleHostUpdate(data.type, data.data);
    });

    // Fetch rounds and total questions count
    fetchRounds();
    fetchTotalQuestions();

    return () => {
      socket.disconnect();
    };
  }, [toast]);

  const startFirstRound = async () => {
    return new Promise<void>((resolve, reject) => {
      if (!socketRef.current) {
        toast({
          title: "Connection Error",
          description: "Not connected to server",
          variant: "destructive",
        });
        reject();
        return;
      }

      if (!roundsLoaded) {
        toast({
          title: "Loading",
          description: "Please wait while rounds are loading...",
        });
        reject();
        return;
      }

      if (rounds.length === 0) {
        toast({
          title: "No Rounds Available",
          description: "Please create rounds in the admin panel first.",
          variant: "destructive",
        });
        reject();
        return;
      }

      // Don't close modal here - just set the game state
      setGameStarted(true);
      setCurrentRound(0); // First round is index 0
      setCurrentQuestion(0);
      setTotalRounds(rounds.length);

      const firstRound = rounds[0];

      // Notify server to activate first round
      socketRef.current.emit("host-change-round", {
        lobbyId: "main-lobby",
        roundId: firstRound.id,
        roundIndex: 0,
        roundName: firstRound.name,
      });

      // Fetch questions for first round
      fetchQuestionsInRound(firstRound.id).then((totalQuestions) => {
        setTotalQuestionsInRound(totalQuestions);
        toast({
          title: "Game Started!",
          description: `Round 1: ${firstRound.name} is now active`,
        });
        resolve();
      });
    });
  };

  const fetchRounds = async () => {
    try {
      const token = localStorage.getItem("hostJwtToken");
      const url = joinUrl(API_BASE, "/questions/rounds");

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Fetched rounds data:", data);
        setRounds(data.rounds || []);
        setRoundsLoaded(true);
        setTotalRounds(data.totalRounds || 0);

        // Check if there's an active round
        if (data.rounds && data.rounds.length > 0) {
          const activeRoundIndex = data.rounds.findIndex(
            (r: any) => r.isActive,
          );

          if (activeRoundIndex >= 0) {
            setCurrentRound(activeRoundIndex);
            // Don't automatically set gameStarted to true here
            // Let the WebSocket connection handle game state
          } else {
            setCurrentRound(-1);
            setGameStarted(false);
          }
        } else {
          setCurrentRound(-1);
          setGameStarted(false);
        }
      } else {
        console.error(
          "Failed to fetch rounds:",
          response.status,
          response.statusText,
        );
        setRounds([]);
        setRoundsLoaded(true);
        setCurrentRound(-1);
        setGameStarted(false);
      }
    } catch (error) {
      console.error("Error fetching rounds:", error);
      setRounds([]);
      setRoundsLoaded(true);
      setCurrentRound(-1);
      setGameStarted(false);
    }
  };

  const fetchTotalQuestions = async () => {
    try {
      const token = localStorage.getItem("hostJwtToken");
      const url = joinUrl(API_BASE, "/questions/total");

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTotalQuestions(data.totalQuestions ?? data.count ?? 0);
      } else {
        console.error(
          "Failed to fetch total questions:",
          response.status,
          response.statusText,
        );
        setTotalQuestions(10); // fallback
      }
    } catch (error) {
      console.error("Error fetching total questions:", error);
      setTotalQuestions(10); // fallback
    }
  };

  const fetchQuestionsInRound = async (roundId: string) => {
    try {
      const token = localStorage.getItem("hostJwtToken");
      const url = joinUrl(API_BASE, `/questions/round/${roundId}/total`);

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const total = data.totalQuestions ?? 0;
        setTotalQuestionsInRound(total);
        console.log(`Fetched ${total} questions for round ${roundId}`);
        return total;
      } else {
        console.error(
          "Failed to fetch questions in round:",
          response.status,
          response.statusText,
        );
        setTotalQuestionsInRound(5); // fallback
        return 5;
      }
    } catch (error) {
      console.error("Error fetching questions in round:", error);
      setTotalQuestionsInRound(5); // fallback
      return 5;
    }
  };

  const handleHostUpdate = (type: string, data: any) => {
    switch (type) {
      case "player-joined":
      case "player-left":
        setPlayerCount(data.playerCount);
        break;

      case "score-updated":
        // Update stats if needed
        break;

      // Add answered count handler
      case "answered-count-updated":
        setAnsweredCount(data.answeredCount);
        console.log(
          `📊 Host: ${data.answeredCount}/${data.totalPlayers} answered`,
        );
        break;

      case "question-started":
        setCurrentQuestionData(data.question);
        setGameStatus("active");
        setCurrentQuestion(data.questionIndex);
        setAnsweredCount(0); // Reset answered count

        // Add this countdown setting
        if (data.startTime) {
          const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
          const remaining = Math.max(0, (data.timeLimit || 30) - elapsed);
          setCountdown(remaining);
          console.log(
            `⏰ Question started with ${remaining}s remaining (server time sync)`,
          );
        } else {
          // Fallback to full time limit
          setCountdown(data.timeLimit || 30);
        }

        toast({
          title: "Question Started!",
          description: `Question ${data.questionIndex} is now live`,
        });
        break;

      case "question-ended":
        setGameStatus("waiting"); // Status goes back to waiting
        setCountdown(0);

        // Show toast with results
        toast({
          title: "Question Ended!",
          description: `Correct answer: ${data.correctAnswer}`,
        });

        // NEW: Check if the server says the round is over
        if (data.isRoundOver) {
          toast({
            title: "🏆 ROUND COMPLETE",
            description:
              "That was the last question! Please click 'Next Round'.",
            duration: 10000, // Show for 10 seconds
            className: "bg-green-600 text-white", // Make it stand out
          });
        }
        break;

      case "countdown-started":
        setGameStatus("countdown");
        setCountdown(data.countdown);
        setCurrentQuestion(data.questionIndex);
        toast({
          title: "Countdown Started!",
          description: `Question ${data.questionIndex} starting in ${data.countdown} seconds`,
        });
        break;

      case "countdown":
        setCountdown(data.countdown);
        break;

      case "game-ended":
        setGameStatus("waiting");
        setCurrentQuestion(0);
        setCurrentRound(-1);
        setGameStarted(false);
        setCurrentQuestionData(null);
        setCountdown(0);
        toast({
          title: "Game Completed!",
          description: "The game has ended. Final results are available.",
        });
        break;

      case "lobby-reset":
        setGameStatus("waiting");
        setCurrentQuestion(0);
        setCurrentRound(0);
        setCurrentQuestionData(null);
        setPlayerCount(0);
        setCountdown(0);
        toast({
          title: "Lobby Reset",
          description: "Lobby has been reset and is ready for a new game",
        });
        break;

      case "stream-control":
        if (data.action === "mute") {
          setIsStreamMuted(data.value);
        } else if (data.action === "change_url") {
          setCurrentStreamUrl(data.value);
        }
        break;

      case "round-changed":
        setCurrentRound(data.roundIndex);

        setCurrentQuestion(data.currentQuestionIndex || 0);

        setTotalQuestionsInRound(data.totalQuestionsInRound);
        setCurrentQuestionData(null);
        setGameStatus("waiting");
        setCountdown(0);

        // Fetch questions for the new round
        fetchQuestionsInRound(data.roundId);

        toast({
          title: "Round Changed!",
          description: data.message || `Now playing: ${data.roundName}`,
        });
        break;

      default:
        console.log("Unhandled lobby update type:", type);
    }
  };

  // Open start modal
  const handleOpenStartModal = () => {
    setShowStartModal(true);
  };

  // Open round selector modal
  const handleOpenRoundSelector = () => {
    setShowRoundSelector(true);
  };

  // Start with countdown
  const handleStartWithCountdown = async () => {
    if (!socketRef.current) return;

    // 🛡️ GUARD CLAUSE: Prevent crashing if rounds aren't loaded yet
    if (!rounds || rounds.length === 0) {
      toast({
        title: "Error",
        description: "Rounds data is not loaded yet. Please wait a moment.",
        variant: "destructive",
      });
      return;
    }

    // If game hasn't started yet, start first round logic
    if (!gameStarted) {
      await startFirstRound();

      setTimeout(() => {
        const seconds = Math.min(60, Math.max(0, countdownSeconds));
        const currentRoundId = rounds[0]?.id;

        if (!currentRoundId) {
          toast({
            title: "Error",
            description: "No round ID available",
            variant: "destructive",
          });
          return;
        }

        socketRef.current!.emit("host-start-countdown", {
          lobbyId: "main-lobby",
          countdownSeconds: seconds,
          questionIndex: 1,
          roundId: currentRoundId,
        });

        setCurrentQuestion(1);
        setGameStatus("countdown");
        setCountdown(seconds);
        setAnsweredCount(0);
        setShowStartModal(false);
      }, 1500);
      return;
    }

    // Regular flow for subsequent questions
    const nextQuestionIndex = currentQuestion + 1;
    const seconds = Math.min(60, Math.max(0, countdownSeconds));

    // 🛡️ GUARD CLAUSE: Ensure we have a valid round index
    if (!rounds[currentRound]) {
      toast({
        title: "Error",
        description: "Current round index is invalid",
        variant: "destructive",
      });
      return;
    }

    const currentRoundId = rounds[currentRound].id;

    socketRef.current.emit("host-start-countdown", {
      lobbyId: "main-lobby",
      countdownSeconds: seconds,
      questionIndex: nextQuestionIndex,
      roundId: currentRoundId,
    });

    setCurrentQuestion(nextQuestionIndex);
    setGameStatus("countdown");
    setCountdown(seconds);
    setAnsweredCount(0);
    setShowStartModal(false);
  };

  // Start immediately
  const handleStartImmediately = async () => {
    if (!socketRef.current) return;

    // If game hasn't started yet, start first round
    if (!gameStarted) {
      try {
        await startFirstRound();
        setShowStartModal(false); // Close modal here

        // Start first question immediately
        const currentRoundId = rounds[0]?.id;

        if (!currentRoundId) {
          toast({
            title: "Error",
            description: "No round ID available",
            variant: "destructive",
          });
          return;
        }

        socketRef.current.emit("host-start-question", {
          lobbyId: "main-lobby",
          questionIndex: 1, // First question is index 1 (1-based)
          roundId: currentRoundId,
        });

        toast({
          title: "Question Started!",
          description: `Question 1 is now live`,
        });
      } catch (error) {
        console.error("Failed to start first round:", error);
      }
      return;
    }

    // Regular flow for subsequent questions
    const nextQuestionIndex = currentQuestion + 1;
    const currentRoundId = rounds[currentRound]?.id;

    if (!currentRoundId) {
      toast({
        title: "Error",
        description: "No round ID available",
        variant: "destructive",
      });
      return;
    }

    socketRef.current.emit("host-start-question", {
      lobbyId: "main-lobby",
      questionIndex: nextQuestionIndex,
      roundId: currentRoundId,
    });

    setCurrentQuestion(nextQuestionIndex);
    setGameStatus("active");
    setAnsweredCount(0);
    setShowStartModal(false); // Close modal here

    toast({
      title: "Question Started!",
      description: `Question ${nextQuestionIndex} is now live`,
    });
  };

  // Start immediately
  // const handleStartImmediately = async () => {
  //   if (!socketRef.current) return;

  //   // If game hasn't started yet, start first round
  //   if (!gameStarted) {
  //     await startFirstRound();

  //     // Wait for round to be set on server before starting question
  //     setTimeout(() => {
  //       socketRef.current!.emit("host-start-question", {
  //         lobbyId: "main-lobby",
  //         questionIndex: 1, // First question is index 1 (1-based)
  //         roundId: rounds[0]?.id,
  //       });

  //       setCurrentQuestion(1); // Set to 1 for UI display
  //       setGameStatus("active");
  //       setAnsweredCount(0);
  //       setShowStartModal(false);

  //       toast({
  //         title: "Question Started!",
  //         description: `Question 1 is now live`,
  //       });
  //     }, 1000); // Increase timeout to 1 second to ensure round is set

  //     return;
  //   }

  //   // Regular flow for subsequent questions
  //   const nextQuestionIndex = currentQuestion + 1;

  //   socketRef.current.emit("host-start-question", {
  //     lobbyId: "main-lobby",
  //     questionIndex: nextQuestionIndex,
  //     roundId: rounds[currentRound]?.id,
  //   });

  //   setCurrentQuestion(nextQuestionIndex);
  //   setGameStatus("active");
  //   setAnsweredCount(0);
  //   setShowStartModal(false);

  //   toast({
  //     title: "Question Started!",
  //     description: `Question ${nextQuestionIndex} is now live`,
  //   });
  // };

  // End current question early
  const handleEndQuestion = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("host-end-question", "main-lobby");
    setGameStatus("waiting");

    toast({
      title: "Question Ended",
      description: "Current question ended by host",
    });
  };

  // Change to next round
  const handleNextRound = () => {
    if (!socketRef.current || rounds.length === 0) return;

    const nextRoundIndex = currentRound + 1;

    if (nextRoundIndex >= rounds.length) {
      toast({
        title: "No More Rounds",
        description: "You've reached the last round",
        variant: "destructive",
      });
      return;
    }

    const nextRound = rounds[nextRoundIndex];

    // Reset question counter for new round
    setCurrentRound(nextRoundIndex);
    setCurrentQuestion(0);
    setGameStarted(true); // Ensure game is marked as started

    socketRef.current.emit("host-change-round", {
      lobbyId: "main-lobby",
      roundId: nextRound.id,
      roundIndex: nextRoundIndex,
      roundName: nextRound.name,
    });

    // Fetch questions for the new round
    fetchQuestionsInRound(nextRound.id);

    toast({
      title: "Round Changed!",
      description: `Now playing: ${nextRound.name}`,
    });
  };

  const shouldShowRoundInfo =
    (gameStarted || currentRound >= 0) && roundsLoaded && currentRound >= 0;
  const currentRoundName = shouldShowRoundInfo
    ? rounds[currentRound]?.name || "Unknown Round"
    : "No Round Active";

  // End game
  const handleEndGame = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("host-end-game", "main-lobby");

    // Reset all state - IMPORTANT: Set currentRound to -1
    setGameStatus("waiting");
    setCurrentQuestion(0);
    setCurrentRound(-1); // Already -1, but keep it
    setTotalQuestionsInRound(0);
    setPlayerCount(0);
    setCurrentQuestionData(null);
    setCountdown(0);
    setGameStarted(false); // Make sure this is false
    setAnsweredCount(0);
    setShowEndGameModal(false); // Close the modal

    toast({
      title: "Game Ended",
      description: "Game has been ended by host",
    });
  };

  const handleStreamMuteToggle = (muted: boolean) => {
    if (!socketRef.current) return;

    setIsStreamMuted(muted);

    // Broadcast mute state to all players
    socketRef.current.emit("host-stream-control", {
      lobbyId: "main-lobby",
      action: "mute",
      value: muted,
    });

    toast({
      title: muted ? "Stream Muted" : "Stream Unmuted",
      description: `All players ${muted ? "muted" : "unmuted"}`,
    });
  };

  const handleStreamUrlChange = (url: string) => {
    if (!socketRef.current) return;

    setCurrentStreamUrl(url);

    // Broadcast new stream URL to all players
    socketRef.current.emit("host-stream-control", {
      lobbyId: "main-lobby",
      action: "change_url",
      value: url,
    });

    toast({
      title: "Stream Updated",
      description: "All players will see the new live stream",
    });
  };

  // Determine if start button should be enabled
  const canStartQuestion = gameStatus === "waiting" || gameStatus === "results";

  // Get current round name
  const getCurrentRoundName = () => {
    if (!roundsLoaded || rounds.length === 0) return "No Rounds";
    return rounds[currentRound]?.name || "Unknown Round";
  };

  return (
    <div
      className="hostpanel-container"
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
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        rounds={rounds}
        currentRoundIndex={currentRound}
      />
      <div className="hostpanel-wrapper">
        <div className="hostpanel-header-left flex items-center justify-between">
          <div className="hostpanel-title leaguegothic leading-none italic">HOST PANEL</div>
          <div className="flex flex-col gap-3">
            {/* In your header section, update the round display */}
            {/* <div className="status-row">
              <div className="glassmorphism-light flex items-center gap-2 text-white mt-0 p-2 bg-muted/30 rounded-lg">
                {gameStatus === "active"
                  ? "🔴 LIVE"
                  : gameStatus === "countdown"
                  ? "⏰ COUNTDOWN"
                  : gameStatus === "paused"
                  ? "⏸️ PAUSED"
                  : gameStatus === "results"
                  ? "📊 RESULTS"
                  : "⏹️ WAITING"}
              </div>
              <span className="question-status">
                {currentRound >= 0 ? (
                  <>
                    Round {currentRound + 1} of {totalRounds}:{" "}
                    {getCurrentRoundName()} - Question{" "}
                    {Math.max(currentQuestion, 0)} / {totalQuestionsInRound}
                  </>
                ) : (
                  "Game not started. Ready to begin."
                )}
              </span>

              {gameStatus === "countdown" && (
                <span className="countdown ml-4 text-2xl font-bold text-yellow-300">
                  {countdown}s
                </span>
              )}
            </div> */}
            <div
              className={`
                flex items-center gap-3 px-5 py-2 rounded-full glassmorphism-medium
                ${
                  isConnected
                    ? "border-green-500 text-green-500"
                    : "border-red-500 text-red-500"
                }
              `}
            >
              {/* Status Dot */}
              <span
                className={`
                  w-3 h-3 rounded-full
                  ${
                    isConnected
                      ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                      : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                  }
                `}
              />

              {/* Status Text */}
              <span className="text-sm font-semibold tracking-wide">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

          </div>
        </div>

        <div className="hostpanel-grid">
          {/* LEFT COLUMN */}
          <div className="left-column">
            <StreamView
              youtubeUrl={currentStreamUrl}
              isMuted={isStreamMuted}
              onMuteToggle={handleStreamMuteToggle}
              isHost={true}
            />

            <Card className="glassmorphism-medium flex flex-col border border-white/30 overflow-hidden">
              {/* Header remains consistent with your brand */}
              <div className="px-6 py-4 border-b border-white/30 bg-white/5">
                <h2 className="text-4xl italic uppercase leaguegothic tracking-wide">
                  Stream Controls
                </h2>
              </div>

              <div className="px-6 py-4">
              <h3 className="text-lg font-semibold mb-3">
                Stream Source
              </h3>
              <div className="space-y-3">
                <Input
                  type="text"
                  value={currentStreamUrl}
                  onChange={(e) => setCurrentStreamUrl(e.target.value)}
                  placeholder="https://www.youtube.com/embed/YOUR_LIVE_STREAM_ID"
                  className="font-mono text-sm"
                />
                <button onClick={() => handleStreamUrlChange(currentStreamUrl)} className="group relative inline-flex items-center justify-between min-w-[160px] p-[1.5px] overflow-hidden rounded-full transition-all hover:scale-[1.02] active:scale-95 shadow-lg">
                  {/* The Gradient Border Layer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]" />
                  
                  {/* The Inner Content Area */}
                  <div className="relative flex items-center justify-between w-full bg-[#121212] rounded-full px-4 py-2 transition-colors group-hover:bg-[#1a1a1a]">
                    <span className="text-white text-xs font-bold tracking-widest uppercase">
                      Update
                    </span>
                    
                    <ArrowUpRight size={14} className="text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </button>
              </div>
              </div>
            </Card>

            {/* <Card className="glassmorphism-medium flex flex-col border border-white/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/30 bg-white/5">
                <h2 className="text-4xl italic uppercase leaguegothic tracking-wide">
                  Game Controls
                </h2>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center px-4 py-2 bg-black/40 rounded-lg border border-white/10">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">System Status</span>
                  <span className="text-sm font-bold text-[#ffae00] flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    {gameStarted ? "IN PROGRESS" : "READY TO START"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="justify-between flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold uppercase tracking-tighter">Option 1: Instant</h3>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest">No delay, game starts now</p>
                    </div>

                    <button 
                      onClick={handleStartImmediately}
                      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#ff1a00] to-[#ff7a00] hover:scale-[1.02] active:scale-95 text-white py-4 rounded-xl transition-all shadow-lg"
                    >
                      <div className="bg-white/20 rounded-full p-1">
                        <Play size={14} fill="white" className="ml-0.5" />
                      </div>
                      <span className="inter text-sm tracking-widest uppercase">
                        {currentQuestion === 0 && !gameStarted ? "Start Game" : "Next Question"}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-col p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold uppercase tracking-tighter text-gray-300">Option 2: Timed</h3>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest">Starts after countdown</p>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="number"
                          value={countdownSeconds}
                          onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                          className="w-full bg-black/60 border border-white/20 rounded-lg py-2 px-3 text-center text-xl font-bold focus:border-blue-500 transition-colors text-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 uppercase">Sec</span>
                      </div>

                      <button 
                        onClick={handleStartWithCountdown}
                        className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 py-3 rounded-lg transition-all text-[10px] inter uppercase tracking-[0.2em]"
                      >
                        <Clock size={14} />
                        Start with {countdownSeconds}s Delay
                      </button>
                    </div>
                  </div>

                </div>

                <p className="text-center text-[10px] text-white/30 font-medium uppercase tracking-[0.3em]">
                  {totalQuestionsInRound > 0 && currentQuestion >= totalQuestionsInRound - 1 
                    ? "Caution: This is the final question in the round" 
                    : "Select a launch method to proceed"}
                </p>
              </div>
            </Card> */}

            <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h2 className="section-title">
                📝{" "}
                {currentQuestionData
                  ? `Question ${currentQuestion}`
                  : "No Question Active"}
              </h2>
              {currentQuestionData ? (
                <div className="question-box">
                  <p className="question-text">
                    {currentQuestionData.text || currentQuestionData.question}
                  </p>
                  <div className="choice-grid">
                    {(
                      currentQuestionData.choices ||
                      currentQuestionData.options ||
                      []
                    ).map((choice, i) => (
                      <div key={i} className="choice-item">
                        {String.fromCharCode(65 + i)}. {choice}
                      </div>
                    ))}
                  </div>
                  <div className="question-meta">
                    <span>Time: {currentQuestionData.timeLimit}s</span>
                    <span>Points: {currentQuestionData.points}</span>
                  </div>
                </div>
              ) : (
                <div className="empty-question">
                  <Clock className="empty-icon" />
                  <p>No question active. Start one to begin.</p>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="right-column">
            {/* <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h3 className="section-title text-4xl leaguegothic uppercase">
                Player Stats
              </h3>
              <div className="stat-block">
                <div className="stat">
                  <span>Total Players</span>
                  <strong>{playerCount}</strong>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "100%" }} />
                </div>
              </div>
              <div className="stat-block">
                <div className="stat">
                  <span>Answered</span>
                  <strong>{answeredCount}</strong>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill secondary"
                    style={{
                      width: `${
                        playerCount > 0
                          ? (answeredCount / playerCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </Card> */}

            <Card className="glassmorphism-medium p-6 flex flex-col gap-6">
              <h2 className="text-4xl leaguegothic uppercase tracking-wider">
                Game Controls
              </h2>

              <div className="space-y-6">
                {/* Current Round Info Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <h3 className="text-lg font-semibold uppercase opacity-80">Current Round</h3>
                    <div className="text-right">
                      <span className="text-sm font-medium uppercase opacity-60">Status: </span>
                      <span className="text-green-500 font-bold">
                        {currentRound >= 0 ? `Round ${currentRound + 1} • Question ${currentQuestion}` : "Lobby"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 rounded-xl border border-white/10 space-y-2">
                    {shouldShowRoundInfo ? (
                      <>
                        <div className="text-xl font-bold">
                          Round {currentRound + 1} of {totalRounds}
                        </div>
                        <div className="text-lg opacity-90">{currentRoundName}</div>
                        <div className="text-sm text-muted-foreground">
                          {totalQuestionsInRound} questions in this round
                        </div>
                        
                        <Button
                          onClick={handleOpenRoundSelector}
                          variant="ghost" // Changed to ghost to remove default border styles
                          size="sm"
                          className="relative p-[1px] rounded-full overflow-hidden mt-2 h-9 group shadow-lg"
                        >
                          {/* The Gradient Border Layer */}
                          <div className="absolute inset-0 bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]" />

                          {/* The Inner Background Content */}
                          <div className="relative flex items-center justify-center w-full h-full px-4 py-2 bg-[#121212] rounded-full transition-colors group-hover:bg-[#1a1a1a]">
                            <Shuffle className="w-3 h-3 mr-2 text-white" />
                            <span className="text-[10px] font-bold text-white tracking-wider">
                              CHANGE ROUNDS
                            </span>
                          </div>
                        </Button>
                      </>
                    ) : (
                      <div className="py-4 text-center opacity-60">
                        <p className="text-xl font-bold">Game Not Started</p>
                        <p className="text-sm">Click "Start Game" below to begin</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <Button
                    onClick={handleOpenStartModal}
                    disabled={!canStartQuestion}
                    variant="ghost"
                    className="relative w-full h-12 p-[1px] rounded-full overflow-hidden group disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]" />
                    <div className="relative flex items-center justify-center w-full h-full bg-[#121212] rounded-full transition-colors group-hover:bg-[#1a1a1a]">
                      <Play className="w-4 h-4 mr-2 text-white" />
                      <span className="text-xs font-bold text-white tracking-widest uppercase">
                        {currentRound < 0 ? "START GAME" : "NEXT QUESTION"}
                      </span>
                    </div>
                  </Button>
                    <p className="text-[10px] text-white text-muted-foreground text-center uppercase tracking-tighter">
                      Start the next question with countdown or immediately
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={handleNextRound}
                      disabled={currentRound >= totalRounds - 1 || currentRound < 0}
                      variant="ghost"
                      className="relative w-full h-12 p-[1px] rounded-full overflow-hidden group disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]" />
                      <div className="relative flex items-center justify-center w-full h-full bg-[#121212] rounded-full transition-colors group-hover:bg-[#1a1a1a]">
                        <Shuffle className="w-4 h-4 mr-2 text-white" />
                        <span className="text-xs font-bold text-white tracking-widest uppercase">
                          NEXT ROUND
                        </span>
                      </div>
                    </Button>
                    <p className="text-[10px] text-white text-muted-foreground text-center uppercase tracking-tighter">
                      Move to the next round
                    </p>
                  </div>
                </div>

                {!(currentRound >= totalRounds - 1 || currentRound < 0) && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowEndGameModal(true)}
                    className="w-full h-10 text-sm inter uppercase tracking-widest bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 border-none shadow-lg rounded-full text-white"
                  >
                    End Game
                  </Button>
                )}
              </div>
            </Card>

            {/* <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h3 className="section-title text-4xl leaguegothic uppercase">
                Game Progress
              </h3>
              <div className="progress-block">
                <span>
                  {currentRound >= 0 ? (
                    <>
                      Round {currentRound + 1} of {totalRounds}
                    </>
                  ) : (
                    <>No Round Active</>
                  )}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        totalRounds > 0 && currentRound >= 0
                          ? ((currentRound + 1) / totalRounds) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="progress-block">
                <span>
                  Question {currentQuestion} / {totalQuestionsInRound}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        totalQuestionsInRound > 0
                          ? (currentQuestion / totalQuestionsInRound) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </Card> */}
            {/* <LeaderboardCard 
              currentRoundIndex={currentRound} 
              rounds={rounds} 
            /> */}
            <LeaderboardCard 
              currentRoundIndex={0} 
              isHost={true} 
            />
          </div>
        </div>

        <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
          <DialogContent className="max-w-3xl border-none p-8 text-white shadow-2xl">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-white inter text-center text-sm uppercase tracking-[0.3em]">
                Select a Launch Method to Proceed
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* OPTION 1: INSTANT */}
              <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#111] p-8 transition-colors hover:border-white/20">
                <div className="space-y-2">
                  <h3 className="text-3xl leaguegothic italic uppercase tracking-tight text-white">
                    Option 1: Instant
                  </h3>
                  <p className="text-xs inter uppercase tracking-widest text-slate-500">
                    No delay, game starts now
                  </p>
                </div>

                <div className="mt-20">
                  <button
                    onClick={handleStartImmediately}
                    className="flex w-full leaguegothic items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff1a00] to-[#ff7a00] py-4 text-2xl uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                      <Play className="h-3 w-3 fill-white text-white" />
                    </div>
                    {currentQuestion === 0 && !gameStarted ? "Start Game" : "Next Question"}
                  </button>
                </div>
              </div>

              {/* OPTION 2: TIMED */}
              <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#111] p-8 transition-colors hover:border-white/20">
                <div className="space-y-2">
                  <h3 className="text-3xl leaguegothic italic uppercase tracking-tight text-white">
                    Option 2: Timed
                  </h3>
                  <p className="text-xs inter uppercase tracking-widest text-slate-500">
                    Starts after countdown
                  </p>
                </div>

                <div className="mt-12 space-y-4">
                  {/* Countdown Input Display */}
                  <div className="relative flex items-center justify-center rounded-2xl border border-white/10 bg-black py-4">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={countdownSeconds}
                      onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                      className="bg-transparent text-center text-3xl leaguegothic text-white focus:outline-none"
                    />
                    <span className=" inter absolute right-6 text-[10px] font-black uppercase tracking-tighter text-slate-600">
                      Sec
                    </span>
                  </div>

                  <button
                    onClick={handleStartWithCountdown}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl text-2xl border border-white/10 bg-[#1a1a1a] py-4 leaguegothic uppercase tracking-widest text-white transition-all hover:bg-[#222] active:scale-95"
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    Start with {countdownSeconds}s Delay
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Round Selector Modal */}
        <Dialog open={showRoundSelector} onOpenChange={setShowRoundSelector}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl text-white">Select Round</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {rounds.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-lg font-semibold mb-2">
                    No Rounds Available
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please create rounds in the admin panel first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {rounds.map((round, index) => (
                    <Button
                      key={round.id}
                      variant={index === currentRound ? "default" : "outline"}
                      className="justify-start h-auto p-4 text-left "
                      onClick={() => {
                        setCurrentRound(index);
                        setCurrentQuestion(0);
                        setTotalQuestionsInRound(0);
                        setShowRoundSelector(false);
                        setGameStarted(true); // Make sure game is marked as started

                        // Fetch questions for selected round
                        fetchQuestionsInRound(round.id);

                        // Emit round change to server
                        socketRef.current?.emit("host-change-round", {
                          lobbyId: "main-lobby",
                          roundId: round.id,
                          roundIndex: index,
                          roundName: round.name,
                        });

                        toast({
                          title: "Round Changed!",
                          description: `Now playing: ${round.name}`,
                        });
                      }}
                    >
                      <div className="flex flex-col items-start">
                        <div className="font-bold text-white">
                          Round {index + 1}: {round.name}
                          {round.isActive && (
                            <Badge variant="secondary" className="ml-2">
                              Active
                            </Badge>
                          )}
                        </div>
                        {round.description && (
                          <div className="text-sm text-muted-foreground">
                            {round.description}
                          </div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* End Game Confirmation Modal */}
        <Dialog open={showEndGameModal} onOpenChange={setShowEndGameModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl text-destructive">
                🚨 End Game?
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-center text-lg mb-2">
                Are you sure you want to end the game?
              </p>
              <p className="text-center text-muted-foreground text-sm">
                This will reset the lobby and disconnect all players. This
                action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEndGameModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!socketRef.current) return;

                  socketRef.current.emit("host-end-game", "main-lobby");
                  setGameStatus("waiting");
                  setCurrentQuestion(0);
                  setCurrentRound(0);
                  setCurrentQuestionData(null);
                  setShowEndGameModal(false);

                  toast({
                    title: "Game Ended",
                    description: "Game has been ended by host",
                  });
                }}
                className="flex-1"
              >
                Yes, End Game
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Host;