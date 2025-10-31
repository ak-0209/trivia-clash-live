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

const Host = () => {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  const [gameStatus, setGameStatus] = useState<
    "waiting" | "countdown" | "active" | "paused" | "results"
  >("waiting");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [currentQuestionData, setCurrentQuestionData] = useState<any>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [showEndGameModal, setShowEndGameModal] = useState(false);

  // Modal state
  const [showStartModal, setShowStartModal] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamMuted, setIsStreamMuted] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(
    import.meta.env.VITE_YOUTUBE_STREAM_URL ||
      "https://www.youtube.com/embed/YDvsBbKfLPA",
  );

  // Connect to WebSocket
  // Connect to WebSocket and restore state
  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
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

    // 🆕 CRITICAL: Listen for lobby-joined event to restore state
    // 🆕 CRITICAL: Listen for lobby-joined event to restore state
    socket.on(
      "lobby-joined",
      (data: {
        lobby: any;
        isNewHost: boolean;
        wasGameInProgress: boolean;
        remainingTime?: number;
        totalQuestions?: number; // 🆕 ADD THIS
      }) => {
        console.log("Host received lobby-joined:", data);

        const { lobby, wasGameInProgress, remainingTime, totalQuestions } =
          data;

        // 🆕 SET TOTAL QUESTIONS FROM SERVER
        if (totalQuestions) {
          setTotalQuestions(totalQuestions);
        }

        // 🆕 CRITICAL: Always restore game state from server
        if (lobby) {
          setPlayerCount(lobby.playerCount || 0);
          setCurrentQuestion(lobby.currentQuestionIndex || 0);

          // 🆕 Only set totalQuestions if not already set from the data
          if (!totalQuestions) {
            setTotalQuestions(lobby.totalQuestions || 10);
          }

          // 🆕 RESTORE CURRENT QUESTION DATA
          if (lobby.currentQuestion) {
            setCurrentQuestionData(lobby.currentQuestion);
          }

          // 🆕 UPDATED status mapping with timer state consideration
          if (lobby.status === "countdown") {
            setGameStatus("countdown");
            setCountdown(lobby.countdown || 0);
          } else if (lobby.status === "in-progress") {
            setGameStatus("active");

            // 🆕 CRITICAL: Use actual remaining time from server, not full time
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

          // 🆕 Show toast for state restoration
          if (wasGameInProgress) {
            toast({
              title: "Game State Restored",
              description: `Resumed from question ${
                lobby.currentQuestionIndex || 0
              }`,
            });
          }
        }
      },
    );

    // socket.on("lobby-update", (data: { type: string; data: any }) => {
    //   console.log("Host received update:", data.type, data.data);
    //   handleHostUpdate(data.type, data.data);
    // });

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

    // Fetch total questions count
    fetchTotalQuestions();

    return () => {
      socket.disconnect();
    };
  }, [toast]);

  // 🆕 Add this function to fetch current lobby state on mount
  // 🆕 Add this function to fetch current lobby state on mount
  // 🆕 Add this function to fetch current lobby state on mount
  useEffect(() => {
    const fetchCurrentLobbyState = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const response = await fetch("/api/lobbies/main-lobby", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const lobbyData = await response.json();
          console.log("Fetched current lobby state:", lobbyData);

          // 🆕 ALWAYS update state with current lobby data, even in waiting state
          if (lobbyData) {
            setPlayerCount(lobbyData.playerCount || 0);
            setCurrentQuestion(lobbyData.currentQuestionIndex || 0); // 🆕 CRITICAL: Always restore question index

            // 🆕 UPDATED status mapping (no more "results" state)
            if (lobbyData.status === "countdown") {
              setGameStatus("countdown");
            } else if (lobbyData.status === "in-progress") {
              setGameStatus("active");
            } else {
              setGameStatus("waiting"); // 🆕 Everything else is "waiting"
            }

            if (lobbyData.currentQuestion) {
              setCurrentQuestionData(lobbyData.currentQuestion);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching current lobby state:", error);
      }
    };

    fetchCurrentLobbyState();
  }, []);

  const fetchTotalQuestions = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch("/api/questions/total", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTotalQuestions(data.totalQuestions || data.count || 0);
      } else {
        console.error("Failed to fetch total questions");
        setTotalQuestions(10); // fallback
      }
    } catch (error) {
      console.error("Error fetching total questions:", error);
      setTotalQuestions(10); // fallback
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

      // 🆕 ADD ANSWERED COUNT HANDLER
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
        setAnsweredCount(0); // 🆕 RESET ANSWERED COUNT

        // 🆕 CRITICAL: ADD THIS COUNTDOWN SETTING
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
        setGameStatus("waiting"); // 🆕 CHANGED from "results" to "waiting"
        setCountdown(0); // 🆕 ADD THIS TO RESET COUNTDOWN
        toast({
          title: "Question Ended!",
          description: `Correct answer: ${data.correctAnswer}`,
        });
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
        setCurrentQuestionData(null);
        setCountdown(0); // 🆕 ADD THIS TO RESET COUNTDOWN
        toast({
          title: "Game Completed!",
          description: "The game has ended. Final results are available.",
        });
        break;

      case "lobby-reset":
        setGameStatus("waiting");
        setCurrentQuestion(0);
        setCurrentQuestionData(null);
        setPlayerCount(0);
        setCountdown(0); // 🆕 ADD THIS TO RESET COUNTDOWN
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

      default:
        console.log("Unhandled lobby update type:", type);
    }
  };

  // Open start modal
  const handleOpenStartModal = () => {
    setShowStartModal(true);
  };

  // Start with countdown
  const handleStartWithCountdown = () => {
    if (!socketRef.current) return;

    const nextQuestionIndex = currentQuestion + 1;
    const seconds = Math.min(60, Math.max(0, countdownSeconds));

    socketRef.current.emit("host-start-countdown", {
      lobbyId: "main-lobby",
      countdownSeconds: seconds,
      questionIndex: nextQuestionIndex,
    });

    setCurrentQuestion(nextQuestionIndex);
    setGameStatus("countdown");
    setCountdown(seconds);
    setAnsweredCount(0);
    setShowStartModal(false);
  };

  // Start immediately
  const handleStartImmediately = () => {
    if (!socketRef.current) return;

    const nextQuestionIndex = currentQuestion + 1;

    socketRef.current.emit("host-start-question", {
      lobbyId: "main-lobby",
      questionIndex: nextQuestionIndex,
    });

    setCurrentQuestion(nextQuestionIndex);
    setGameStatus("active");
    setAnsweredCount(0);
    setShowStartModal(false);

    toast({
      title: "Question Started!",
      description: `Question ${nextQuestionIndex} is now live`,
    });
  };

  // 🎮 HOST: End current question early
  const handleEndQuestion = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("host-end-question", "main-lobby");
    setGameStatus("waiting"); // 🆕 CHANGED from "results" to "waiting"

    toast({
      title: "Question Ended",
      description: "Current question ended by host",
    });
  };

  // 🎮 HOST: End game
  const handleEndGame = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("host-end-game", "main-lobby");
    setGameStatus("waiting");
    setCurrentQuestion(0);
    setCurrentQuestionData(null);

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

  // const handlePauseGame = () => {
  //   setGameStatus("paused");
  //   toast({
  //     title: "Game Paused",
  //     description: "Players can no longer submit answers",
  //   });
  // };

  // const handleResumeGame = () => {
  //   setGameStatus("active");
  //   toast({
  //     title: "Game Resumed",
  //     description: "Players can now submit answers",
  //   });
  // };

  // Determine if start button should be enabled
  const canStartQuestion = gameStatus === "waiting" || gameStatus === "results";

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
      <div className="hostpanel-wrapper">
        {/* Header */}
        <header className="hostpanel-header">
          <div className="hostpanel-header-left flex flex-col items-center">
            <div className="hostpanel-title leaguegothic">HOST PANEL</div>
            <div className="flex flex-col gap-3">
              <div className="status-row">
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
                  Question {currentQuestion} / {totalQuestions}
                </span>
                {gameStatus === "countdown" && (
                  <span className="countdown">{countdown}</span>
                )}
              </div>
              <div className="justify-center glassmorphism-light flex items-center gap-2 text-white mt-0 p-2 bg-muted/30 rounded-lg">
                {isConnected ? "🟢 CONNECTED" : "🔴 DISCONNECTED"}
              </div>
            </div>
          </div>
        </header>

        <div className="hostpanel-grid">
          {/* LEFT COLUMN */}
          <div className="left-column">
            <Card className="glassmorphism-medium px-4 py-4 flex flex-col gap-4">
              <h2 className="section-title text-4xl leaguegothic uppercase">Live Stream Manager</h2>
              <div className="stream-grid flex flex-col gap-4">
                <div className="flex flex-col gap-4">
                  <h3>📡 Stream Source</h3>
                  <StreamView
                    youtubeUrl={currentStreamUrl}
                    isMuted={isStreamMuted}
                    onMuteToggle={handleStreamMuteToggle}
                    isHost={true}
                  />
                </div>
              </div>
            </Card>

            <Card className="glassmorphism-medium p-6 flex flex-col gap-4">
              <h2 className="text-4xl leaguegothic uppercase">Live Stream Manager</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Stream URL Control */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    📡 Stream Source
                  </h3>
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={currentStreamUrl}
                      onChange={(e) => setCurrentStreamUrl(e.target.value)}
                      placeholder="https://www.youtube.com/embed/YOUR_LIVE_STREAM_ID"
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={() => handleStreamUrlChange(currentStreamUrl)}
                      variant="hero"
                      className="w-full glassmorphism-light flex items-center gap-2 text-white"
                    >
                      <Radio className="w-4 h-4 mr-2" />
                      Update Live Stream for Everyone
                    </Button>
                  </div>
                </div>

                {/* Audio Controls */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    🔊 Audio Control
                  </h3>
                  <div className="space-y-3">
                    <Button
                      variant={isStreamMuted ? "outline" : "destructive"}
                      onClick={() => handleStreamMuteToggle(!isStreamMuted)}
                      className="w-full flex items-center gap-2"
                    >
                      {isStreamMuted ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                      {isStreamMuted
                        ? "Unmute All Players"
                        : "Mute All Players"}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                      {isStreamMuted
                        ? "All players have muted audio"
                        : "All players can hear the stream"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 🆕 Stream Status */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg glassmorphism-light flex items-center gap-2 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4" style={{flex:"1 0 0"}}>
                  <span className="text-sm font-medium">
                    Live Stream Status:
                  </span>
                  <Badge variant="destructive" className="animate-pulse">
                    🔴 BROADCASTING TO {playerCount} PLAYERS
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Question Controls */}
            {/* Question Controls */}
            <Card className="glassmorphism-medium p-6 flex flex-col gap-4">
              <h2 className="text-4xl leaguegothic uppercase">Question Controls</h2>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Button
                    variant="hero"
                    onClick={handleOpenStartModal}
                    disabled={!canStartQuestion}
                    className="w-full glassmorphism-light flex items-center gap-2 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {currentQuestion === 0 ? "Start Game" : "Next Question"}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    {canStartQuestion
                      ? "Start the next question with countdown or immediately"
                      : "Question is currently active"}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => setShowEndGameModal(true)} // 🆕 CHANGED to open modal
                    className=""
                  >
                    End Game
                  </Button>
                </div>
              </div>

              {/* 🆕 SIMPLIFIED Game State Controls - Removed pause and duplicate buttons */}
              <div className="grid gap-4">
                {gameStatus === "active" && (
                  <Button
                    variant="game"
                    onClick={handleEndQuestion}
                    className="w-full"
                  >
                    End Question Early
                  </Button>
                )}

                {/* {gameStatus === "paused" && (
                  <Button
                    variant="hero"
                    onClick={handleResumeGame}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume Question
                  </Button>
                )} */}
              </div>
            </Card>

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
                    {(currentQuestionData.choices ||
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
            <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h3 className="section-title text-4xl leaguegothic uppercase">Player Stats</h3>
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
            </Card>

            <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h3 className="section-title text-4xl leaguegothic uppercase">Game Progress</h3>
              <div className="progress-block">
                <span>
                  {currentQuestion} / {totalQuestions}
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        totalQuestions > 0
                          ? (currentQuestion / totalQuestions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </Card>

            <Card className="glassmorphism-medium px-6 py-6 flex flex-col gap-4">
              <h3 className="section-title text-4xl leaguegothic uppercase">Quick Actions</h3>
              <Button variant="outline" size="sm">
                <Users className="icon" />
                View All Players
              </Button>
            </Card>
          </div>
        </div>

        <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {currentQuestion === 0
                  ? "Start Game"
                  : currentQuestion >= totalQuestions - 1
                  ? "Final Question"
                  : "Next Question"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* 🆕 CHECK IF LAST QUESTION */}
              {currentQuestion >= totalQuestions - 1 ? (
                <div className="text-center">
                  <p className="text-lg font-semibold mb-4">
                    🎯 This is the final question!
                  </p>
                  <Button
                    onClick={handleStartImmediately}
                    variant="hero"
                    className="w-full py-6 glassmorphism-light flex items-center gap-2 text-white"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Final Question
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    After this question, the game will end automatically
                  </p>
                </div>
              ) : (
                <>
                  {/* Immediate Start Option */}
                  <div className="text-center">
                    <Button
                      onClick={handleStartImmediately}
                      variant="hero"
                      className="w-full py-6 text-lg glassmorphism-light flex items-center gap-2 text-white"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {currentQuestion === 0 ? "Start Game" : "Start Immediately"}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      {currentQuestion === 0
                        ? "Game will begin right away"
                        : "Question will begin right away"}
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or start with countdown
                      </span>
                    </div>
                  </div>

                  {/* Countdown Option */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={countdownSeconds}
                        onChange={(e) =>
                          setCountdownSeconds(Number(e.target.value))
                        }
                        className="text-center text-lg font-semibold"
                      />
                      <span className="text-muted-foreground">seconds</span>
                    </div>

                    <Button
                      onClick={handleStartWithCountdown}
                      variant="outline"
                      className="w-full py-6"
                    >
                      <Clock className="w-5 h-5 mr-2" />
                      Start with {countdownSeconds}s Countdown
                    </Button>
                  </div>
                </>
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
                This will reset the lobby and disconnect all players. This action
                cannot be undone.
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
