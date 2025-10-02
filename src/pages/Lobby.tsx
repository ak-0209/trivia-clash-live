import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Clock } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";
import StreamView from "@/components/StreamView";
import "./Lobby.scss";

const Lobby = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(120); // 2 minutes until start
  const [playerCount, setPlayerCount] = useState(342);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/game');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate players joining
    const playersTimer = setInterval(() => {
      setPlayerCount(prev => prev + Math.floor(Math.random() * 5));
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(playersTimer);
    };
  }, [navigate]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="lobby">
      <div className="lobby__container">
        {/* Header */}
        <div className="lobby__header">
          <h1 className="lobby__title">
            WAITING LOBBY
          </h1>
          <p className="lobby__subtitle">
            Get ready for the next round!
          </p>
        </div>

        {/* Main Grid */}
        <div className="lobby__grid">
          {/* Left Column - Stream and Info */}
          <div className="lobby__main">
            {/* Stream */}
            <StreamView />

            {/* Game Info Cards */}
            <div className="lobby__stats">
              <Card className="lobby__stat-card lobby__stat-card--primary">
                <Clock />
                <div className="lobby__stat-content">
                  <div className="lobby__stat-value">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </div>
                  <div className="lobby__stat-label">Until Start</div>
                </div>
              </Card>

              <Card className="lobby__stat-card lobby__stat-card--secondary">
                <Users />
                <div className="lobby__stat-content">
                  <div className="lobby__stat-value">
                    {playerCount}
                  </div>
                  <div className="lobby__stat-label">Players Joined</div>
                </div>
              </Card>

              <Card className="lobby__stat-card lobby__stat-card--accent">
                <Trophy />
                <div className="lobby__stat-content">
                  <div className="lobby__stat-value">
                    $5,000
                  </div>
                  <div className="lobby__stat-label">Prize Pool</div>
                </div>
              </Card>
            </div>

            {/* Rules Card */}
            <Card className="lobby__rules">
              <h3>📋 Game Rules</h3>
              <ul>
                <li>✓ 30 seconds per question</li>
                <li>✓ Faster correct answers earn more points</li>
                <li>✓ No joining once game starts</li>
                <li>✓ Top 10% share the prize pool</li>
              </ul>
            </Card>
          </div>

          {/* Right Column - Leaderboard */}
          <div>
            <Leaderboard title="Current Rankings" />
          </div>
        </div>

        {/* Action Button */}
        <div className="lobby__actions">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate('/')}
          >
            Leave Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
