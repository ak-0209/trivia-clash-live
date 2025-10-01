import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Home } from "lucide-react";

const mockLeaderboard = [
  { rank: 1, name: "AlexChamp", score: 8750, prize: "$1,500" },
  { rank: 2, name: "QuizMaster", score: 8420, prize: "$1,000" },
  { rank: 3, name: "BrainBox", score: 8180, prize: "$750" },
  { rank: 4, name: "SpeedyGenius", score: 7950, prize: "$500" },
  { rank: 5, name: "TriviaKing", score: 7820, prize: "$400" },
  { rank: 6, name: "SmartCookie", score: 7650, prize: "$300" },
  { rank: 7, name: "ThinkFast", score: 7420, prize: "$200" },
  { rank: 8, name: "MindBender", score: 7210, prize: "$150" },
  { rank: 9, name: "QuickWit", score: 7050, prize: "$100" },
  { rank: 10, name: "BrainyPlayer", score: 6890, prize: "$100" },
];

const LeaderboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Trophy className="w-20 h-20 mx-auto mb-6 text-primary glow-strong" />
          <h1 className="text-5xl md:text-6xl font-black gradient-text mb-4">
            FINAL RESULTS
          </h1>
          <p className="text-xl text-muted-foreground">
            Congratulations to all winners!
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="glass-panel p-6 mb-8">
          <div className="space-y-3">
            {mockLeaderboard.map((player) => (
              <div
                key={player.rank}
                className={`p-4 rounded-lg flex items-center justify-between ${
                  player.rank <= 3
                    ? 'bg-gradient-to-r from-primary/20 to-secondary/20 glow-primary'
                    : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                      player.rank === 1
                        ? 'bg-primary text-primary-foreground'
                        : player.rank === 2
                        ? 'bg-secondary text-secondary-foreground'
                        : player.rank === 3
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {player.rank}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.score.toLocaleString()} points
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-primary">
                    {player.prize}
                  </div>
                  <div className="text-xs text-muted-foreground">Prize</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="hero" size="lg" onClick={() => navigate('/lobby')}>
            <Trophy className="w-5 h-5" />
            Join Next Game
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/')}>
            <Home className="w-5 h-5" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
