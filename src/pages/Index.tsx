import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Zap, DollarSign } from "lucide-react";
import heroImage from "@/assets/hero-trivia.jpg";
import "./Index.scss";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="index">
      {/* Hero Section */}
      <section className="index__hero">
        <div 
          className="index__hero-bg"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.3)',
          }}
        />
        <div className="index__hero-overlay" />
        
        <div className="index__hero-content">
          <h1 className="index__title">
            LIVE TRIVIA
          </h1>
          <p className="index__subtitle">
            Compete in Real-Time. Win Real Money.
          </p>
          <p className="index__description">
            Join thousands of players in live trivia games with cash prizes. 30 minutes of intense competition.
          </p>
          
          <div className="index__actions">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => navigate('/lobby')}
              className="animate-pulse-glow"
            >
              <Zap className="w-5 h-5" />
              Join Next Game
            </Button>
            <Button 
              variant="secondary" 
              size="xl"
              onClick={() => navigate('/host')}
            >
              <Users className="w-5 h-5" />
              Host Panel
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="index__features">
            <div className="index__feature-card index__feature-card--primary">
              <Trophy />
              <h3>Win Big</h3>
              <p>
                Top players share the prize pool based on leaderboard position
              </p>
            </div>
            
            <div className="index__feature-card index__feature-card--secondary">
              <Zap />
              <h3>Real-Time Action</h3>
              <p>
                All players answer simultaneously with live leaderboard updates
              </p>
            </div>
            
            <div className="index__feature-card index__feature-card--accent">
              <DollarSign />
              <h3>Easy Entry</h3>
              <p>
                Pay once to enter, winners get automatic payouts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="index__how-it-works">
        <h2 className="index__section-title">
          How It Works
        </h2>
        
        <div className="index__steps">
          <div className="index__step">
            <div className="index__step-number index__step-number--primary">
              1
            </div>
            <div className="index__step-content">
              <h3>Pay & Join Lobby</h3>
              <p>
                Pay entry fee and wait in the lobby. Watch the live host stream and see other players joining.
              </p>
            </div>
          </div>

          <div className="index__step">
            <div className="index__step-number index__step-number--secondary">
              2
            </div>
            <div className="index__step-content">
              <h3>Answer Questions</h3>
              <p>
                When game starts, answer questions in 30 seconds. Faster correct answers earn more points!
              </p>
            </div>
          </div>

          <div className="index__step">
            <div className="index__step-number index__step-number--accent">
              3
            </div>
            <div className="index__step-content">
              <h3>Win Prizes</h3>
              <p>
                Top performers share the prize pool. Automatic payouts to winners!
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
