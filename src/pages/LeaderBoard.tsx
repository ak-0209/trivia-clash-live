import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Trophy, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface LeaderboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoundIndex: number;
  rounds?: Round[]; // <--- MADE OPTIONAL
}

export function LeaderboardSidebar({
  isOpen,
  onClose,
  currentRoundIndex,
  rounds: propRounds, // <--- Rename prop to avoid conflict
}: LeaderboardSidebarProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string>("overall");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [fetchedRounds, setFetchedRounds] = useState<Round[]>([]); // Internal state for Lobby
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL;

  // COMPUTE WHICH ROUNDS TO USE: Props (Host) or Fetched (Lobby)
  const activeRounds = propRounds || fetchedRounds;

  // 1. Fetch Rounds ONLY if not passed via props
  useEffect(() => {
    if (propRounds) return; // Skip if Host passed them

    const fetchRounds = async () => {
      try {
        const userDataStr = localStorage.getItem("user");
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        const token =
          localStorage.getItem("hostJwtToken") ||
          localStorage.getItem("jwtToken") ||
          userData.token;

        const res = await fetch(`${API_BASE}/questions/rounds`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        if (res.ok) {
          const data = await res.json();
          setFetchedRounds(data.rounds || []);
        }
      } catch (e) {
        console.error("Failed to fetch rounds", e);
      }
    };
    fetchRounds();
  }, [API_BASE, propRounds]);

  // 2. Auto-select Current Round
  useEffect(() => {
    if (isOpen) {
      // Use activeRounds here
      if (
        activeRounds.length > 0 &&
        currentRoundIndex >= 0 &&
        activeRounds[currentRoundIndex]
      ) {
        setSelectedRoundId(activeRounds[currentRoundIndex].id);
      } else {
        setSelectedRoundId("overall");
      }
    }
  }, [isOpen, activeRounds, currentRoundIndex]);

  // 3. Fetch Leaderboard
  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, selectedRoundId]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const userDataStr = localStorage.getItem("user");
      const userData = userDataStr ? JSON.parse(userDataStr) : {};
      const token =
        localStorage.getItem("hostJwtToken") ||
        localStorage.getItem("jwtToken") ||
        userData.token;

      let url = `${API_BASE}/lobbies/main-lobby/leaderboard`;

      if (selectedRoundId !== "overall") {
        url += `?type=round&roundId=${selectedRoundId}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Styles
  const getRankStyles = (index: number) => {
    if (index === 0)
      return "bg-yellow-500 text-white shadow-sm ring-2 ring-yellow-500/20";
    if (index === 1)
      return "bg-zinc-300 text-zinc-900 shadow-sm ring-2 ring-zinc-300/20";
    if (index === 2)
      return "bg-orange-500 text-white shadow-sm ring-2 ring-orange-500/20";
    return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/80 z-[90] transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-zinc-950 border-l border-zinc-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[100] overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5 min-h-screen text-zinc-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="bg-yellow-500/10 p-2 rounded-full">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Leaderboard
                </h2>
                <p className="text-xs text-zinc-400">
                  {selectedRoundId === "overall"
                    ? "Total Score"
                    : "Round Score"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Round Selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Filter by Round
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setSelectedRoundId("overall")}
                variant={selectedRoundId === "overall" ? "default" : "outline"}
                size="sm"
                className={`text-xs h-8 border transition-colors ${
                  selectedRoundId === "overall"
                    ? "bg-white text-zinc-950 hover:bg-zinc-200 border-white"
                    : "bg-transparent text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                Overall
              </Button>

              {/* USE activeRounds HERE */}
              {activeRounds.map((round) => (
                <Button
                  key={round.id}
                  onClick={() => setSelectedRoundId(round.id)}
                  variant={selectedRoundId === round.id ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-8 border transition-colors ${
                    selectedRoundId === round.id
                      ? "bg-white text-zinc-950 hover:bg-zinc-200 border-white"
                      : "bg-transparent text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {round.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Leaderboard List */}
          <Card className="border border-zinc-800 shadow-sm bg-zinc-900/50 flex-1">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase">
                  Rankings
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchLeaderboard}
                  className="h-6 w-6 text-zinc-400 hover:text-white"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  No scores yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((player, index) => (
                    <div
                      key={player.userId}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${getRankStyles(
                            index,
                          )}`}
                        >
                          {index + 1}
                        </div>
                        <span className="font-medium text-sm text-zinc-200 truncate max-w-[150px]">
                          {player.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {selectedRoundId === "overall"
                          ? player.score
                          : player.roundScore}{" "}
                        pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
