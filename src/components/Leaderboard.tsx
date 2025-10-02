import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import "./Leaderboard.scss";

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
    <Card className="leaderboard">
      <div className="leaderboard__header">
        <Trophy />
        <h2>{title}</h2>
      </div>

      <div className="leaderboard__list">
        {mockPlayers.map((player) => (
          <div
            key={player.rank}
            className={`leaderboard__item ${
              player.rank <= 3 
                ? 'leaderboard__item--podium' 
                : 'leaderboard__item--default'
            }`}
          >
            <div className="leaderboard__player">
              <div
                className={`leaderboard__rank ${
                  player.rank === 1
                    ? 'leaderboard__rank--1'
                    : player.rank === 2
                    ? 'leaderboard__rank--2'
                    : player.rank === 3
                    ? 'leaderboard__rank--3'
                    : 'leaderboard__rank--default'
                }`}
              >
                {player.rank}
              </div>
              <div className="leaderboard__name">{player.name}</div>
            </div>
            <div className="leaderboard__score">
              {player.score.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default Leaderboard;
