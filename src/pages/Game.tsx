import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";
import StreamView from "@/components/StreamView";
import Leaderboard from "@/components/Leaderboard";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

const mockQuestions: Question[] = [
  {
    id: 1,
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2
  },
  {
    id: 2,
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1
  },
  {
    id: 3,
    question: "Who painted the Mona Lisa?",
    options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"],
    correctAnswer: 2
  }
];

const Game = () => {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = mockQuestions[currentQuestionIndex];
  const progress = ((30 - timeLeft) / 30) * 100;

  useEffect(() => {
    if (isWaiting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isWaiting, currentQuestionIndex]);

  const handleTimeUp = () => {
    if (selectedAnswer === null) {
      setIsWaiting(true);
      setTimeout(nextQuestion, 3000);
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    
    if (index === currentQuestion.correctAnswer) {
      const timeBonus = Math.floor(timeLeft * 10);
      setScore(prev => prev + 1000 + timeBonus);
    }
    
    setIsWaiting(true);
    setTimeout(nextQuestion, 3000);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < mockQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsWaiting(false);
      setTimeLeft(30);
    } else {
      navigate('/leaderboard');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black gradient-text">
              QUESTION {currentQuestionIndex + 1} / {mockQuestions.length}
            </h1>
            <p className="text-muted-foreground">Your Score: {score}</p>
          </div>
          <Card className="glass-panel px-6 py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-2xl font-black text-primary">
                {timeLeft}s
              </span>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Question */}
          <div className="lg:col-span-2 space-y-6">
            {!isWaiting ? (
              <>
                {/* Timer Progress */}
                <Progress value={progress} className="h-2" />

                {/* Question Card */}
                <Card className="glass-panel p-8 glow-primary">
                  <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
                    {currentQuestion.question}
                  </h2>

                  {/* Answer Options */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => (
                      <Button
                        key={index}
                        variant={selectedAnswer === index ? "game" : "outline"}
                        size="lg"
                        className="h-auto py-6 text-lg font-semibold"
                        onClick={() => handleAnswerSelect(index)}
                        disabled={selectedAnswer !== null}
                      >
                        <span className="mr-3 text-xl font-black">
                          {String.fromCharCode(65 + index)}
                        </span>
                        {option}
                      </Button>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <>
                {/* Waiting Screen */}
                <StreamView />
                <Card className="glass-panel p-8 text-center">
                  <h2 className="text-2xl font-bold mb-4">
                    {selectedAnswer === currentQuestion.correctAnswer 
                      ? "🎉 Correct!" 
                      : selectedAnswer === null 
                      ? "⏰ Time's Up!" 
                      : "❌ Incorrect"}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    Waiting for next question...
                  </p>
                  <div className="animate-pulse text-primary text-lg">
                    Next question starting soon
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Right Column - Leaderboard */}
          <div className="lg:col-span-1">
            <Leaderboard title="Live Rankings" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
