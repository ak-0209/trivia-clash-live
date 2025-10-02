import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Clock } from "lucide-react";
import Leaderboard from "@/components/Leaderboard";
import StreamView from "@/components/StreamView";

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
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-black gradient-text mb-2">
            WAITING LOBBY
          </h1>
          <p className="text-muted-foreground text-lg">
            Get ready for the next round!
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Stream and Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stream */}
            <StreamView />

            {/* Game Info Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="glass-panel p-6">
                <Clock className="w-8 h-8 text-primary mb-3 mx-auto" />
                <div className="text-center">
                  <div className="text-3xl font-black text-primary mb-1">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </div>
                  <div className="text-sm text-muted-foreground">Until Start</div>
                </div>
              </Card>

              <Card className="glass-panel p-6">
                <Users className="w-8 h-8 text-secondary mb-3 mx-auto" />
                <div className="text-center">
                  <div className="text-3xl font-black text-secondary mb-1">
                    {playerCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Players Joined</div>
                </div>
              </Card>

              <Card className="glass-panel p-6">
                <Trophy className="w-8 h-8 text-accent mb-3 mx-auto" />
                <div className="text-center">
                  <div className="text-3xl font-black text-accent mb-1">
                    $5,000
                  </div>
                  <div className="text-sm text-muted-foreground">Prize Pool</div>
                </div>
              </Card>
            </div>

            {/* Rules Card */}
            <Card className="glass-panel p-6">
              <h3 className="text-xl font-bold mb-4">📋 Game Rules</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>✓ 30 seconds per question</li>
                <li>✓ Faster correct answers earn more points</li>
                <li>✓ No joining once game starts</li>
                <li>✓ Top 10% share the prize pool</li>
              </ul>
            </Card>
          </div>

          {/* Right Column - Leaderboard */}
          <div className="lg:col-span-1">
            <Leaderboard title="Current Rankings" />
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 text-center">
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
