import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";
import StreamView from "@/components/StreamView";
import Leaderboard from "@/components/Leaderboard";
import "./Game.scss";

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
    <div className="game">
      <div className="game__container">
        {/* Header */}
        <div className="game__header">
          <div className="game__info">
            <h1>
              QUESTION {currentQuestionIndex + 1} / {mockQuestions.length}
            </h1>
            <p>Your Score: {score}</p>
          </div>
          <Card className="game__timer-card">
            <Clock />
            <span>
              {timeLeft}s
            </span>
          </Card>
        </div>

        <div className="game__grid">
          {/* Left Column - Question */}
          <div className="game__main">
            {!isWaiting ? (
              <>
                {/* Timer Progress */}
                <Progress value={progress} className="game__progress" />

                {/* Question Card */}
                <Card className="game__question-card">
                  <h2 className="game__question-text">
                    {currentQuestion.question}
                  </h2>

                  {/* Answer Options */}
                  <div className="game__answers">
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
                <Card className="game__waiting">
                  <h2>
                    {selectedAnswer === currentQuestion.correctAnswer 
                      ? "🎉 Correct!" 
                      : selectedAnswer === null 
                      ? "⏰ Time's Up!" 
                      : "❌ Incorrect"}
                  </h2>
                  <p>
                    Waiting for next question...
                  </p>
                  <div className="game__waiting-text">
                    Next question starting soon
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Right Column - Leaderboard */}
          <div>
            <Leaderboard title="Live Rankings" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
