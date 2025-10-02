import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipForward, Users, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import StreamView from "@/components/StreamView";
import "./Host.scss";

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
    <div className="host">
      <div className="host__container">
        {/* Header */}
        <div className="host__header">
          <h1>
            HOST PANEL
          </h1>
          <div className="host__header-info">
            <Badge variant={gameStatus === 'active' ? 'default' : 'secondary'} className="text-sm">
              {gameStatus === 'active' ? '🔴 LIVE' : gameStatus === 'paused' ? '⏸️ PAUSED' : '⏹️ WAITING'}
            </Badge>
            <span>
              Question {currentQuestion} / 10
            </span>
          </div>
        </div>

        <div className="host__grid">
          {/* Left Column - Controls */}
          <div className="host__main">
            {/* Stream Preview */}
            <StreamView />

            {/* Game Controls */}
            <Card className="host__controls">
              <h2>🎮 Game Controls</h2>
              
              <div className="host__controls-grid">
                {gameStatus === 'waiting' && (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleStartGame}
                    style={{ gridColumn: '1 / -1' }}
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
                      style={{ gridColumn: 'span 2' }}
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
                      style={{ gridColumn: 'span 2' }}
                    >
                      <SkipForward className="w-5 h-5" />
                      Next Question
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Current Question */}
            <Card className="host__question">
              <h2>📝 Current Question</h2>
              <div className="host__question-content">
                <p>
                  What is the capital of France?
                </p>
                <div className="host__question-options">
                  <div className="host__question-option host__question-option--default">A. London</div>
                  <div className="host__question-option host__question-option--default">B. Berlin</div>
                  <div className="host__question-option host__question-option--correct">
                    C. Paris ✓
                  </div>
                  <div className="host__question-option host__question-option--default">D. Madrid</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Stats */}
          <div className="host__sidebar">
            {/* Player Stats */}
            <Card className="host__stats">
              <h3>👥 Player Stats</h3>
              
              <div className="host__stats-list">
                <div className="host__stat">
                  <div className="host__stat-header">
                    <span>Total Players</span>
                    <span>{totalPlayers}</span>
                  </div>
                  <div className="host__stat-bar">
                    <div 
                      className="host__stat-bar-fill host__stat-bar-fill--primary"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div className="host__stat">
                  <div className="host__stat-header">
                    <span>Answered</span>
                    <span style={{ color: 'hsl(200 85% 50%)' }}>{answeredCount}</span>
                  </div>
                  <div className="host__stat-bar">
                    <div 
                      className="host__stat-bar-fill host__stat-bar-fill--secondary"
                      style={{ width: `${(answeredCount / totalPlayers) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="host__stat">
                  <div className="host__stat-header">
                    <span>Waiting</span>
                    <span>
                      {totalPlayers - answeredCount}
                    </span>
                  </div>
                  <div className="host__stat-bar">
                    <div 
                      className="host__stat-bar-fill host__stat-bar-fill--muted"
                      style={{ width: `${((totalPlayers - answeredCount) / totalPlayers) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Answer Distribution */}
            <Card className="host__distribution">
              <h3>📊 Answer Distribution</h3>
              <div className="host__distribution-list">
                {['A: 12%', 'B: 23%', 'C: 58%', 'D: 7%'].map((item, i) => (
                  <div key={i} className="host__distribution-item">
                    <span className="host__distribution-item-label">{item.split(':')[0]}</span>
                    <div className="host__distribution-item-bar">
                      <div 
                        className={`host__distribution-item-bar-fill ${i === 2 ? 'host__distribution-item-bar-fill--primary' : 'host__distribution-item-bar-fill--muted'}`}
                        style={{ width: item.split(':')[1].trim() }}
                      />
                    </div>
                    <span className="host__distribution-item-value">
                      {item.split(':')[1].trim()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="host__quick-actions">
              <h3>⚡ Quick Actions</h3>
              <div className="host__quick-actions-list">
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
