import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipForward, Users, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StreamView from "@/components/StreamView";

const Host = () => {
  const { toast } = useToast();
  const [gameStatus, setGameStatus] = useState<'waiting' | 'active' | 'paused'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answeredCount, setAnsweredCount] = useState(287);
  const totalPlayers = 342;

  const handleStartGame = () => {
    setGameStatus('active');
    toast({
      title: "Game Started!",
      description: "Question 1 is now live for all players",
    });
  };

  const handlePauseGame = () => {
    setGameStatus('paused');
    toast({
      title: "Game Paused",
      description: "Players can no longer submit answers",
    });
  };

  const handleNextQuestion = () => {
    setCurrentQuestion(prev => prev + 1);
    setAnsweredCount(0);
    setGameStatus('active');
    toast({
      title: "Next Question",
      description: `Question ${currentQuestion + 1} is now live`,
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black gradient-text mb-2">
            HOST PANEL
          </h1>
          <div className="flex items-center gap-3">
            <Badge variant={gameStatus === 'active' ? 'default' : 'secondary'} className="text-sm">
              {gameStatus === 'active' ? '🔴 LIVE' : gameStatus === 'paused' ? '⏸️ PAUSED' : '⏹️ WAITING'}
            </Badge>
            <span className="text-muted-foreground">
              Question {currentQuestion} / 10
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stream Preview */}
            <StreamView />

            {/* Game Controls */}
            <Card className="glass-panel p-6">
              <h2 className="text-xl font-bold mb-4">🎮 Game Controls</h2>
              
              <div className="grid md:grid-cols-3 gap-4">
                {gameStatus === 'waiting' && (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleStartGame}
                    className="md:col-span-3"
                  >
                    <Play className="w-5 h-5" />
                    Start Game
                  </Button>
                )}

                {gameStatus === 'active' && (
                  <>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handlePauseGame}
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </Button>
                    <Button
                      variant="game"
                      size="lg"
                      onClick={handleNextQuestion}
                      className="md:col-span-2"
                    >
                      <SkipForward className="w-5 h-5" />
                      Next Question
                    </Button>
                  </>
                )}

                {gameStatus === 'paused' && (
                  <>
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={() => setGameStatus('active')}
                    >
                      <Play className="w-5 h-5" />
                      Resume
                    </Button>
                    <Button
                      variant="game"
                      size="lg"
                      onClick={handleNextQuestion}
                      className="md:col-span-2"
                    >
                      <SkipForward className="w-5 h-5" />
                      Next Question
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Current Question */}
            <Card className="glass-panel p-6">
              <h2 className="text-xl font-bold mb-4">📝 Current Question</h2>
              <div className="bg-muted/30 rounded-lg p-6">
                <p className="text-lg font-semibold mb-4">
                  What is the capital of France?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-card/50 rounded">A. London</div>
                  <div className="p-3 bg-card/50 rounded">B. Berlin</div>
                  <div className="p-3 bg-primary/20 rounded border-2 border-primary">
                    C. Paris ✓
                  </div>
                  <div className="p-3 bg-card/50 rounded">D. Madrid</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Player Stats */}
            <Card className="glass-panel p-6">
              <h3 className="text-lg font-bold mb-4">👥 Player Stats</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Players</span>
                    <span className="font-bold">{totalPlayers}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Answered</span>
                    <span className="font-bold text-secondary">{answeredCount}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-secondary transition-all"
                      style={{ width: `${(answeredCount / totalPlayers) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Waiting</span>
                    <span className="font-bold text-muted-foreground">
                      {totalPlayers - answeredCount}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-muted-foreground transition-all"
                      style={{ width: `${((totalPlayers - answeredCount) / totalPlayers) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Answer Distribution */}
            <Card className="glass-panel p-6">
              <h3 className="text-lg font-bold mb-4">📊 Answer Distribution</h3>
              <div className="space-y-3">
                {['A: 12%', 'B: 23%', 'C: 58%', 'D: 7%'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-12">{item.split(':')[0]}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div 
                        className={`h-full ${i === 2 ? 'bg-primary' : 'bg-muted-foreground/50'}`}
                        style={{ width: item.split(':')[1].trim() }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-10 text-right">
                      {item.split(':')[1].trim()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="glass-panel p-6">
              <h3 className="text-lg font-bold mb-4">⚡ Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Users className="w-4 h-4" />
                  View All Players
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <CheckCircle2 className="w-4 h-4" />
                  End Game Early
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Host;
