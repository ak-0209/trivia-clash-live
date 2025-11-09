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
            <div className="l2 leaguegothic">
              Compete in Real-Time. Win Real Money.
            </div>
            <div className="l3">
              Join thousands of players in live trivia games with cash prizes.
              30 minutes of intense competition.
            </div>
          </div>

          <div className="hero_bt">
            <div
              className="bt1 leaguegothic cursor-pointer"
              onClick={() => navigate("/auth")}
            >
              JOIN NEXT MATCH
            </div>
            <div
              className="bt2 leaguegothic cursor-pointer"
              onClick={() => navigate("/host-auth")}
            >
              HOST PANEL
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 px-2 py-6">
            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">Win Big</h3>
              <p className="text-white/70 inter card-desc">
                Every correct answer boosts you up the ranks. Battle for a top
                spot and secure a bigger piece of the prize pool.
              </p>
            </div>

            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">
                Real-Time Action
              </h3>
              <p className="text-white/70 inter card-desc">
                Face off against thousands of players at once. Lock in your
                answers fast and watch the leaderboard change with every single
                question.
              </p>
            </div>

            <div className="card-info glassmorphism-light">
              <h3 className="text-white leaguegothic card-header">
                Easy Entry
              </h3>
              <p className="text-white/70 inter card-desc">
                Forget long sign-ups. Pay your entry and you're in. Winners get
                instant, automatic cashouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="how-container">
          <h2 className="how-title leaguegothic text-white l1">How It Works</h2>

          <div className="how-steps">
            {[
              {
                step: 1,
                title: "Pay & Join Lobby",
                text: "Pay the entry fee and join the lobby. Watch the live host stream and see other players joining in real time.",
                gradient: "gradient-indigo",
              },
              {
                step: 2,
                title: "Answer Questions",
                text: "Once the game starts, answer questions within 30 seconds. Faster correct answers earn more points!",
                gradient: "gradient-purple",
              },
              {
                step: 3,
                title: "Win Prizes",
                text: "Top performers share the prize pool. Winners receive instant payouts automatically.",
                gradient: "gradient-pink",
              },
            ].map(({ step, title, text, gradient }) => (
              <div key={step} className="how-card">
                <div className="how-card-inner">
                  <div className={`how-step`}>{step}</div>
                  <div className="how-content">
                    <h3 className="how-subtitle">{title}</h3>
                    <p className="how-text">{text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
