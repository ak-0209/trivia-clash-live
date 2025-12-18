import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Loader2, Home, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import dressingroom from "@/assets/dressingroom.webp"; // Using your same background

interface Player {
  rank: number;
  userId: string;
  name: string;
  score: number;
  roundScore?: number;
}

interface Round {
  id: string;
  name: string;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [selectedRoundId, setSelectedRoundId] = useState<string>("overall");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL;

  useEffect(() => {
    // Clean up data older than 1 hour
    const cleanupOldData = () => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      // Clean directLeaderboard
      const direct = localStorage.getItem("directLeaderboard");
      if (direct) {
        try {
          const parsed = JSON.parse(direct);
          if (now - parsed.timestamp > oneHour) {
            localStorage.removeItem("directLeaderboard");
          }
        } catch (e) {}
      }

      // Clean gameEndData
      const gameEnd = localStorage.getItem("gameEndData");
      if (gameEnd) {
        try {
          const parsed = JSON.parse(gameEnd);
          if (now - parsed.timestamp > oneHour) {
            localStorage.removeItem("gameEndData");
          }
        } catch (e) {}
      }
    };

    cleanupOldData();
  }, []);

  // 1. Initial Data Fetch (Rounds & Scores)
  useEffect(() => {
    fetchRounds();
    fetchLeaderboard();
  }, [selectedRoundId]);

  const fetchRounds = async () => {
    try {
      const response = await fetch(`${API_BASE}/questions/rounds`); // Adjust endpoint if needed
      if (response.ok) {
        const data = await response.json();
        setRounds(data.rounds || []);
      }
    } catch (error) {
      console.error("Error fetching rounds:", error);
    }
  };

  const fetchLeaderboard = async () => {
    setIsLoading(true);

    try {
      // SOURCE 1: Check if data was passed in navigation state (from Lobby.tsx)
      const locationState =
        (window.history.state && window.history.state.usr) || {};
      if (
        locationState.leaderboard &&
        Array.isArray(locationState.leaderboard)
      ) {
        console.log("Using leaderboard from navigation state");
        setLeaderboard(locationState.leaderboard);
        return;
      }

      // SOURCE 2: Check for game session ID
      const urlParams = new URLSearchParams(window.location.search);
      const gameSessionId =
        urlParams.get("session") || localStorage.getItem("lastGameSessionId");

      if (gameSessionId) {
        try {
          const response = await fetch(
            `${API_BASE}/game-sessions/${gameSessionId}`,
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.players) {
              console.log("Using game session from API");
              setLeaderboard(data.players);
              return;
            }
          }
        } catch (error) {
          console.error("Error fetching game session:", error);
        }
      }

      // SOURCE 3: Check localStorage for cached data (last resort)
      const cached = localStorage.getItem("lastLeaderboard");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            console.log("Using cached leaderboard from localStorage");
            setLeaderboard(parsed);
            return;
          }
        } catch (error) {
          console.error("Error parsing cached leaderboard:", error);
        }
      }

      // If nothing works
      setLeaderboard([]);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setLeaderboard([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Rank Styles (Reused from your sidebar)
  const getRankStyles = (index: number) => {
    if (index === 0)
      return "bg-yellow-500 text-white shadow-lg ring-4 ring-yellow-500/20 scale-110";
    if (index === 1)
      return "bg-zinc-300 text-zinc-900 shadow-md ring-2 ring-zinc-300/20";
    if (index === 2)
      return "bg-orange-500 text-white shadow-md ring-2 ring-orange-500/20";
    return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  };

  return (
    <div
      className="min-h-screen w-full bg-zinc-950 flex flex-col items-center p-4 md:p-8"
      style={{
        backgroundImage: `
          linear-gradient(to top, rgba(9, 9, 11, 0.95), rgba(9, 9, 11, 0.8)),
          url(${dressingroom})
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="w-full max-w-4xl space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-yellow-500/10 rounded-full mb-4 ring-1 ring-yellow-500/20">
            <Trophy className="w-12 h-12 text-yellow-500" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase leaguegothic">
            Final Standings
          </h1>
          <p className="text-zinc-400 text-lg">Thank you for playing!</p>
        </div>

        {/* Controls Card */}
        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                onClick={() => setSelectedRoundId("overall")}
                variant={selectedRoundId === "overall" ? "default" : "outline"}
                className={`transition-all ${
                  selectedRoundId === "overall"
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "bg-transparent border-zinc-700 text-zinc-300"
                }`}
              >
                Overall
              </Button>
              {rounds.map((round) => (
                <Button
                  key={round.id}
                  onClick={() => setSelectedRoundId(round.id)}
                  variant={selectedRoundId === round.id ? "default" : "outline"}
                  className={`transition-all ${
                    selectedRoundId === round.id
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-transparent border-zinc-700 text-zinc-300"
                  }`}
                >
                  {round.name}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchLeaderboard()}
                className="text-zinc-400 hover:text-white"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="border-zinc-700 text-zinc-300 bg-transparent hover:bg-zinc-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Back Home
              </Button>
            </div>
          </div>
        </Card>

        {/* Leaderboard List */}
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {selectedRoundId === "overall"
                  ? "🏆 Overall Ranking"
                  : "🎯 Round Ranking"}
              </h2>
              <Badge
                variant="outline"
                className="text-zinc-400 border-zinc-700"
              >
                {leaderboard.length} Players
              </Badge>
            </div>

            {isLoading ? (
              <div className="py-20 flex flex-col items-center text-zinc-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Loading results...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                No scores recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((player, index) => (
                  <div
                    key={player.userId}
                    className="group flex items-center justify-between p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-900/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 md:gap-6">
                      <div
                        className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full font-bold text-sm md:text-lg ${getRankStyles(
                          index,
                        )}`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-lg md:text-xl text-zinc-100 group-hover:text-white transition-colors">
                          {player.name}
                        </span>
                        {index === 0 && (
                          <span className="text-xs text-yellow-500 font-medium uppercase tracking-wider">
                            Champion
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        {selectedRoundId === "overall"
                          ? player.score
                          : player.roundScore}
                      </span>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Points
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
