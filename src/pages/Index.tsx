import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Zap, DollarSign } from "lucide-react";
import heroImage from "@/assets/hero-trivia.jpg";
import dressingroom from "@/assets/dressingroom.webp";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${dressingroom})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/0 to-background z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center">
          <div className="herosection">
            <div className="l1 leaguegothic">TOPCLUB LIVE TRIVIA</div>
            <div className="l2 leaguegothic">Compete in Real-Time. Win Real Money.</div>
            <div className="l3">Join thousands of players in live trivia games with cash prizes. 30 minutes of intense competition.</div>
          </div>

          <div className="hero_bt">
            <div className="bt1 leaguegothic cursor-pointer" onClick={() => navigate("/auth")}>JOIN NEXT MATCH</div>
            <div className="bt2 leaguegothic cursor-pointer" onClick={() => navigate("/host")}>HOST PANEL</div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 px-2 py-6">
            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">Win Big</h3>
              <p className="text-white/70 inter card-desc">
                Every correct answer boosts you up the ranks. Battle for a top spot and secure a bigger piece of the prize pool.
              </p>
            </div>

            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">Real-Time Action</h3>
              <p className="text-white/70 inter card-desc">
                Face off against thousands of players at once. Lock in your answers fast and watch the leaderboard change with every single question.
              </p>
            </div>

            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">Easy Entry</h3>
              <p className="text-white/70 inter card-desc">
                Forget long sign-ups. Pay your entry and you're in. Winners get instant, automatic cashouts.
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
                  Pay entry fee and wait in the lobby. Watch the live host
                  stream and see other players joining.
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
                  When game starts, answer questions in 30 seconds. Faster
                  correct answers earn more points!
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
                  Top performers share the prize pool. Automatic payouts to
                  winners!
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
