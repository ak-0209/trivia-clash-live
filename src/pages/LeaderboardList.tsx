import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2, RefreshCw } from "lucide-react";

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
}

export function LeaderboardCard({
  currentRoundIndex,
  rounds: propRounds,
}: LeaderboardCardProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string>("overall");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [fetchedRounds, setFetchedRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL;
  const activeRounds = propRounds || fetchedRounds;

  // 1. Fetch Rounds if not provided
  useEffect(() => {
    if (propRounds) return;
    const fetchRounds = async () => {
      try {
        const userDataStr = localStorage.getItem("user");
        const userData = userDataStr ? JSON.parse(userDataStr) : {};
        const token = localStorage.getItem("hostJwtToken") || localStorage.getItem("jwtToken") || userData.token;

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

  // 2. Fetch Leaderboard on change
  useEffect(() => {
    fetchLeaderboard();
  }, [selectedRoundId, currentRoundIndex]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const userDataStr = localStorage.getItem("user");
      const userData = userDataStr ? JSON.parse(userDataStr) : {};
      const token = localStorage.getItem("hostJwtToken") || localStorage.getItem("jwtToken") || userData.token;

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

  const getRankStyles = (index: number) => {
    if (index === 0) return "bg-yellow-500 text-white shadow-sm ring-2 ring-yellow-500/20";
    if (index === 1) return "bg-zinc-300 text-zinc-900 shadow-sm ring-2 ring-zinc-300/20";
    if (index === 2) return "bg-orange-500 text-white shadow-sm ring-2 ring-orange-500/20";
    return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  };

  return (
    <Card className="glassmorphism-medium p-6 flex flex-col gap-4 border-white/10">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-3xl leaguegothic uppercase tracking-wider text-white">Leaderboard</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchLeaderboard}
          className="h-8 w-8 text-white/40 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
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
        {activeRounds.slice(0, 3).map((round) => ( // Show first 3 rounds for space
          <Button
            key={round.id}
            onClick={() => setSelectedRoundId(round.id)}
            // variant="ghost"
            size="sm"
            className={`text-[10px] font-bold h-7 rounded-full border transition-all ${
              selectedRoundId === round.id
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/10"
            }`}
          >
            {round.name.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Player List */}
      <div className="space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/20" /></div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-10 text-white/40 text-sm">No scores recorded yet.</div>
        ) : (
          leaderboard.map((player, index) => (
            <div
              key={player.userId}
              className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] ${getRankStyles(index)}`}>
                  {index + 1}
                </div>
                <span className="font-medium text-sm text-white truncate max-w-[120px]">
                  {player.name}
                </span>
              </div>
              <span className="text-sm font-bold text-white">
                {selectedRoundId === "overall" ? player.score : player.roundScore} pts
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}