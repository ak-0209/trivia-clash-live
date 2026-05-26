import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react"; // Removed RefreshCw

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

interface LeaderboardCardProps {
  currentRoundIndex: number;
  rounds?: Round[];
  isHost?: boolean;
  currentUserId?: string;
  liveLeaderboard?: Player[];
}

export function LeaderboardCard({
  currentRoundIndex,
  rounds: propRounds,
  isHost = false,
  currentUserId,
  liveLeaderboard,
}: LeaderboardCardProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string>("overall");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [fetchedRounds, setFetchedRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL;
  const activeRounds = propRounds || fetchedRounds;

  // 1. Fetch Rounds if not provided (Standard setup)
  useEffect(() => {
    if (propRounds) return;
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
      const params = new URLSearchParams();
      if (selectedRoundId !== "overall") {
        params.set("type", "round");
        params.set("roundId", selectedRoundId);
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;

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

  useEffect(() => {
    if (
      selectedRoundId === "overall" &&
      liveLeaderboard &&
      liveLeaderboard.length > 0
    ) {
      setLeaderboard(liveLeaderboard);
      setIsLoading(false);
      return;
    }
    fetchLeaderboard();
  }, [selectedRoundId, currentRoundIndex, API_BASE, liveLeaderboard]);

  const getRankStyles = (index: number) => {
    if (index === 0)
      return "bg-yellow-500 text-white shadow-sm ring-2 ring-yellow-500/20";
    if (index === 1)
      return "bg-zinc-300 text-zinc-900 shadow-sm ring-2 ring-zinc-300/20";
    if (index === 2)
      return "bg-orange-500 text-white shadow-sm ring-2 ring-orange-500/20";
    return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  };

  const displayPlayers = leaderboard;

  const isCurrentUser = (player: Player) =>
    String(player.userId) === String(currentUserId);

  return (
    <Card className="glassmorphism-medium p-6 flex flex-col gap-4 border-white/10">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-3xl leaguegothic uppercase tracking-wider text-white">
            Leaderboard
          </h2>
        </div>

        {/* REFRESH BUTTON REMOVED HERE - No longer needed */}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setSelectedRoundId("overall")}
          variant="ghost"
          size="sm"
          className={`text-[10px] font-bold h-7 rounded-full border transition-all ${
            selectedRoundId === "overall"
              ? "bg-white text-black border-white"
              : "bg-transparent text-white/60 border-white/10"
          }`}
        >
          OVERALL
        </Button>
        {activeRounds.slice(0, 3).map((round, index) => (
          <Button
            key={round.id}
            onClick={() => setSelectedRoundId(round.id)}
            size="sm"
            className={`text-[10px] font-bold h-7 rounded-full border transition-all ${
              selectedRoundId === round.id
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/10"
            }`}
          >
            {`ROUND ${index + 1}`}
          </Button>
        ))}
      </div>

      {/* Player List */}
      <div className="space-y-2 min-h-[200px] max-h-[min(60vh,520px)] overflow-y-auto pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-white/20" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-10 text-white/40 text-sm">
            No scores recorded yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayPlayers.map((player, index) => {
              const you = isCurrentUser(player);

              return (
                <div
                  key={player.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                    you
                      ? "bg-white/10 border-white/30 shadow-lg"
                      : "bg-black/40 border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-[10px] ${getRankStyles(
                        index,
                      )}`}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={`font-medium text-sm truncate ${
                        you ? "text-yellow-400" : "text-white"
                      }`}
                    >
                      {player.name}
                      {you && (
                        <span className="text-[10px] opacity-60 ml-1">
                          (YOU)
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white shrink-0 ml-2">
                    {selectedRoundId === "overall"
                      ? player.score
                      : (player.roundScore ?? 0)}{" "}
                    pts
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
