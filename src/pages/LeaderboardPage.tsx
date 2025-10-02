import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Home } from "lucide-react";
import "./LeaderboardPage.scss";

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
    <div className="leaderboard-page">
      <div className="leaderboard-page__container">
        {/* Header */}
        <div className="leaderboard-page__header">
          <Trophy />
          <h1>
            FINAL RESULTS
          </h1>
          <p>
            Congratulations to all winners!
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="leaderboard-page__list">
          <div className="leaderboard-page__items">
            {mockLeaderboard.map((player) => (
              <div
                key={player.rank}
                className={`leaderboard-page__item ${
                  player.rank <= 3
                    ? 'leaderboard-page__item--podium'
                    : 'leaderboard-page__item--default'
                }`}
              >
                <div className="leaderboard-page__player">
                  <div
                    className={`leaderboard-page__rank ${
                      player.rank === 1
                        ? 'leaderboard-page__rank--1'
                        : player.rank === 2
                        ? 'leaderboard-page__rank--2'
                        : player.rank === 3
                        ? 'leaderboard-page__rank--3'
                        : 'leaderboard-page__rank--default'
                    }`}
                  >
                    {player.rank}
                  </div>
                  <div className="leaderboard-page__player-info">
                    <div className="leaderboard-page__player-info-name">{player.name}</div>
                    <div className="leaderboard-page__player-info-score">
                      {player.score.toLocaleString()} points
                    </div>
                  </div>
                </div>
                <div className="leaderboard-page__prize">
                  <div className="leaderboard-page__prize-amount">
                    {player.prize}
                  </div>
                  <div className="leaderboard-page__prize-label">Prize</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="leaderboard-page__actions">
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
