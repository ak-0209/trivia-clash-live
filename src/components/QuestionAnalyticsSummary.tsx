import { Card } from "@/components/ui/card";
import { BarChart3, Eye } from "lucide-react";

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
      <div className="flex items-center justify-center h-40 text-white/30">
        <p className="text-sm">Waiting for question to end...</p>
      </div>
    );
  }

  const { totalAnswered, choiceDistribution } = analytics;
  const totalAnswers = totalAnswered || 0;

  // Sort choices by count (descending)
  const sortedChoices = Object.entries(choiceDistribution)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([choice, count]) => ({
      choice,
      count,
    }));

  // Calculate percentages (store as numeric values)
  const choicesWithPct = sortedChoices.map(({ choice, count }) => {
    const percentage =
      totalAnswers > 0
        ? parseFloat(((count / totalAnswers) * 100).toFixed(1))
        : 0;
    return { choice, count, percentage };
  });

  return (
    <Card className="glassmorphism-medium p-6 flex flex-col gap-4 border-white/10">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-2xl font-bold uppercase tracking-widest text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-[#ff7a00]" />
          Question Analytics
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-green-500 font-bold uppercase tracking-widest">
            {analytics.totalAnswered} Answers
          </span>
          <span className="text-xs text-white/50 font-mono">
            ({totalAnswers} Total Players)
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-6 border-b border-white/10 pb-6">
        <p className="text-sm text-white/70">Answer Distribution:</p>

        <div className="flex flex-col gap-2">
          {choicesWithPct.map(({ choice, count, percentage }, index) => {
            const barWidth = percentage === 0 ? "1%" : `${percentage}%`;

            return (
              <div
                key={index}
                className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0"
              >
                <span className="text-white font-medium w-32">{choice}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${
                        index === 0
                          ? "bg-gradient-to-r from-[#ff1a00] to-[#ff7a00]"
                          : "bg-white/40"
                      }`}
                      style={{ width: barWidth }}
                    />
                  </div>
                  <div className="flex gap-3 w-24 text-right">
                    <span className="text-xs text-white/70 font-mono">
                      {count} ({Math.round(percentage)}%)
                    </span>
                    <span className="text-sm font-bold text-white">
                      {count} votes
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
