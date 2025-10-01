import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface LeaderboardProps {
  title?: string;
}

const mockPlayers = [
  { rank: 1, name: "AlexChamp", score: 8750 },
  { rank: 2, name: "QuizMaster", score: 8420 },
  { rank: 3, name: "BrainBox", score: 8180 },
  { rank: 4, name: "SpeedyGenius", score: 7950 },
  { rank: 5, name: "TriviaKing", score: 7820 },
  { rank: 6, name: "SmartCookie", score: 7650 },
  { rank: 7, name: "ThinkFast", score: 7420 },
  { rank: 8, name: "MindBender", score: 7210 },
];

const Leaderboard = ({ title = "Leaderboard" }: LeaderboardProps) => {
  return (
    <Card className="glass-panel p-6 h-fit sticky top-8">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      <div className="space-y-2">
        {mockPlayers.map((player) => (
          <div
            key={player.rank}
            className={`p-3 rounded-lg flex items-center justify-between ${
              player.rank <= 3 
                ? 'bg-primary/20 border border-primary/30' 
                : 'bg-muted/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
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
                <div className="font-semibold text-sm">{player.name}</div>
              </div>
            </div>
            <div className="text-sm font-bold text-primary">
              {player.score.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default Leaderboard;
