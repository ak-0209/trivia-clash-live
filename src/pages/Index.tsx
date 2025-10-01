import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Zap, DollarSign } from "lucide-react";
import heroImage from "@/assets/hero-trivia.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.3)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background z-10" />
        
        <div className="relative z-20 container mx-auto px-4 text-center">
          <h1 className="text-6xl md:text-8xl font-black mb-6 gradient-text">
            LIVE TRIVIA
          </h1>
          <p className="text-xl md:text-3xl mb-4 text-foreground/90 font-semibold">
            Compete in Real-Time. Win Real Money.
          </p>
          <p className="text-lg md:text-xl mb-12 text-muted-foreground max-w-2xl mx-auto">
            Join thousands of players in live trivia games with cash prizes. 30 minutes of intense competition.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
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
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="glass-panel p-6 rounded-xl">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">Win Big</h3>
              <p className="text-muted-foreground">
                Top players share the prize pool based on leaderboard position
              </p>
            </div>
            
            <div className="glass-panel p-6 rounded-xl">
              <Zap className="w-12 h-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-bold mb-2">Real-Time Action</h3>
              <p className="text-muted-foreground">
                All players answer simultaneously with live leaderboard updates
              </p>
            </div>
            
            <div className="glass-panel p-6 rounded-xl">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-bold mb-2">Easy Entry</h3>
              <p className="text-muted-foreground">
                Pay once to enter, winners get automatic payouts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 gradient-text">
          How It Works
        </h2>
        
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="glass-panel p-8 rounded-xl">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Pay & Join Lobby</h3>
                <p className="text-muted-foreground text-lg">
                  Pay entry fee and wait in the lobby. Watch the live host stream and see other players joining.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-xl">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Answer Questions</h3>
                <p className="text-muted-foreground text-lg">
                  When game starts, answer questions in 30 seconds. Faster correct answers earn more points!
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-xl">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Win Prizes</h3>
                <p className="text-muted-foreground text-lg">
                  Top performers share the prize pool. Automatic payouts to winners!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
