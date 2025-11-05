import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Home } from "lucide-react";
import dressingroom from "@/assets/dressingroom.webp";
import { joinUrl } from "./Host";

interface LeaderboardPlayer {
  rank: number;
  userId: string;
  name: string;
  score: number;
  lastAnswerCorrect?: boolean;
  hasAnsweredCurrentQuestion?: boolean;
}

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = import.meta.env.VITE_API_URL;
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("jwtToken");
        const url = joinUrl(API_BASE, "/lobbies/leaderboard/main-lobby")

        const response = await fetch(url, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
          // credentials: "include" // uncomment if you rely on cookies
        });
        if (!response.ok) {
          console.error(
            `Failed to fetch lobby state: ${response.status} ${response.statusText}`,
          );
          return;
        }

        const lobbyData = await response.json();
        setLeaderboard(lobbyData.leaderboard)
      } catch (err: any) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div
      className="min-h-screen p-4 md:p-8 bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${dressingroom})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div className="relative container mx-auto max-w-4xl z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <Trophy className="w-20 h-20 mx-auto mb-4 text-yellow-400 animate-bounce" />
          <h1 className="text-6xl md:text-6xl leaguegothic text-white">
            LEADERBOARD
          </h1>
        </div>

        {/* Leaderboard */}
        <Card className="glassmorphism-medium p-6 mb-8 inter">
          {loading ? (
            <div className="text-center text-gray-300">Loading...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center text-gray-300">No players yet</div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((player) => (
                <div
                  key={player.userId}
                  className={`flex items-center justify-between p-4 rounded-xl glassmorphism-medium transition-all duration-300 transform hover:scale-105 ${
                    player.rank <= 3 ? "border-l-4 border-yellow-400" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 leaguegothic h-12 rounded-full flex items-center justify-center text-lg ${
                        player.rank === 1
                          ? "bg-yellow-400 text-gray-900"
                          : player.rank === 2
                          ? "bg-gray-300 text-gray-900"
                          : player.rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      {player.rank}
                    </div>
                    <div>
                      <div className="font-semibold text-lg md:text-xl">
                        {player.name}
                      </div>
                      {/* <div className="text-sm text-gray-300">
                        {player.score.toLocaleString()} points
                      </div> */}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl md:text-4xl text-white leaguegothic">
                      {player.score} PTS
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/lobby")}
            className="glassmorphism-medium px-6 py-6 text-4xl md:text-4xl flex items-center text-white  transition-all duration-300 leaguegothic uppercase"
          >
            <Trophy className="w-5 h-5" />
            Join Next Game
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/")}
            className="glassmorphism-medium px-6 py-6 p-4 text-4xl md:text-4xl flex text-white items-center gap-2 border-gray-400 transition-all duration-300 leaguegothic uppercase"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
