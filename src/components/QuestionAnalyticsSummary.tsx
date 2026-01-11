import { Card } from "@/components/ui/card";
import { BarChart3, Eye, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";

interface AnalyticsData {
  totalAnswered: number;
  choiceDistribution: Record<string, number>;
}

interface Props {
  analytics: AnalyticsData | null;
}

export const QuestionAnalyticsSummary = ({ analytics }: Props) => {
  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-white/5 bg-white/2">
        <div className="relative mb-2">
          <BarChart3 className="w-8 h-8 text-white/10 animate-pulse" />
        </div>
        <p className="text-sm text-white/30 font-medium italic">Waiting for results...</p>
      </div>
    );
  }

  const { totalAnswered, choiceDistribution } = analytics;
  const totalAnswers = totalAnswered || 0;

  const sortedChoices = Object.entries(choiceDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([choice, count]) => ({
      choice,
      count,
      percentage: totalAnswers > 0 ? (count / totalAnswers) * 100 : 0,
    }));

  return (
    <Card className="relative overflow-hidden border-white/10 bg-slate-950/40 backdrop-blur-xl p-6 shadow-2xl">
      {/* Background Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 blur-[100px] rounded-full" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Eye className="w-5 h-5 text-[#ff7a00]" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Question Analytics</h3>
          </div>
          <p className="text-xs text-white/40 font-medium uppercase tracking-widest">Live Response Tracking</p>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="flex flex-col items-end">
            <span className="text-xl font-black text-white leading-none">{totalAnswers}</span>
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Total Players</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <Users className="w-5 h-5 text-white/20" />
        </div>
      </div>

      <div className="space-y-5">
        {sortedChoices.map(({ choice, count, percentage }, index) => {
          const isWinner = index === 0 && count > 0;
          
          return (
            <div key={choice} className="group relative">
              <div className="flex justify-between items-end mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isWinner ? 'text-white' : 'text-white/60'}`}>
                    {choice}
                  </span>
                  {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-white">{Math.round(percentage)}%</span>
                  <span className="text-[10px] text-white/30 font-medium uppercase">{count} votes</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: index * 0.1 }}
                  className={`h-full rounded-full relative ${
                    isWinner 
                      ? "bg-gradient-to-r from-[#ff1a00] via-[#ff7a00] to-[#ffb800] shadow-[0_0_15px_rgba(255,122,0,0.3)]" 
                      : "bg-white/20"
                  }`}
                >
                  {/* Glossy overlay on the bar */}
                  <div className="absolute inset-0 bg-white/10 opacity-50 overflow-hidden">
                    <div className="absolute inset-0 translate-x-[-100%] animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-orange-500/20" />
          ))}
        </div>
      </div>
    </Card>
  );
};