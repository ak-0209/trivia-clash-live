// scripts/seed-soccer-questions.ts
/**
 * Seed mock soccer questions into existing DB collection using the provided Question model.
 *
 * Usage:
 * 1. Add MONGO_URI (or MONGODB_URI / DATABASE_URL) to your .env:
 *    MONGO_URI=mongodb+srv://user:pass@cluster0.mongodb.net/mydb?retryWrites=true&w=majority
 *
 * 2. Run:
 *    npx ts-node scripts/seed-soccer-questions.ts
 *    (or compile to JS and run with node)
 */

import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import QuestionModel, { IQuestion } from "./src/models/question";

async function main() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error(
      "Missing MongoDB URI. Add MONGO_URI (or MONGODB_URI / DATABASE_URL) to your .env",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // options typed as any so this compiles across mongoose versions
      // TS: ignore options typing differences between versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }

  // Mock soccer questions (non-time-sensitive facts where possible)
  const questions: IQuestion[] = [
    {
      text: "How many players does each team have on the field in a standard association football match?",
      choices: ["9", "10", "11", "12"],
      correctIndex: 2,
      timeLimit: 20,
      points: 50,
      metadata: { category: "rules", difficulty: "easy" },
    },
    {
      text: "Which country has won the most FIFA World Cup tournaments?",
      choices: ["Germany", "Italy", "Argentina", "Brazil"],
      correctIndex: 3,
      timeLimit: 25,
      points: 150,
      metadata: { category: "history", difficulty: "medium" },
    },
    {
      text: "What is the maximum number of substitutions a team may make in most major competitions since 2020 (regular time, not counting temporary experimental rules)?",
      choices: ["3", "4", "5", "6"],
      correctIndex: 2,
      timeLimit: 30,
      points: 120,
      metadata: { category: "rules", difficulty: "medium" },
    },
    {
      text: "Which position is primarily responsible for preventing the opposition from scoring and is usually the last line of defense?",
      choices: ["Midfielder", "Striker", "Goalkeeper", "Winger"],
      correctIndex: 2,
      timeLimit: 15,
      points: 40,
      metadata: { category: "positions", difficulty: "easy" },
    },
    {
      text: "What is awarded when the whole ball crosses the goal line (between the posts and under the crossbar) and last touched by an attacking player?",
      choices: ["Corner kick", "Goal kick", "Penalty kick", "Goal"],
      correctIndex: 3,
      timeLimit: 20,
      points: 70,
      metadata: { category: "rules", difficulty: "easy" },
    },
    {
      text: "Which of the following is/are considered attacking positions? (select all that apply)",
      choices: ["Striker", "Full-back", "Attacking midfielder", "Centre-back"],
      correctAnswers: [0, 2], // multi-answer: Striker and Attacking midfielder
      timeLimit: 30,
      points: 130,
      metadata: { category: "positions", difficulty: "medium", multi: true },
    },
    {
      text: 'What does "offside" require for an attacking player to be penalized?',
      choices: [
        "Being in the opponent’s half and nearer to the opponent’s goal line than both the ball and the second-last defender at the moment the ball is played",
        "Touching the ball with hands",
        "Committing a foul inside the penalty area",
        "Being behind the ball when it is played",
      ],
      correctIndex: 0,
      timeLimit: 30,
      points: 140,
      metadata: { category: "rules", difficulty: "hard" },
    },
    {
      text: "How long is one standard half in professional football (excluding added/stoppage time)?",
      choices: ["30 minutes", "35 minutes", "40 minutes", "45 minutes"],
      correctIndex: 3,
      timeLimit: 15,
      points: 50,
      metadata: { category: "rules", difficulty: "easy" },
    },
    {
      text: "Which of these is a common method for restarting play after the ball has gone out of bounds along the touchline?",
      choices: ["Goal kick", "Throw-in", "Corner kick", "Free kick"],
      correctIndex: 1,
      timeLimit: 15,
      points: 40,
      metadata: { category: "rules", difficulty: "easy" },
    },
    {
      text: "Select the two roles that are typically part of a football team's defensive structure. (choose both)",
      choices: [
        "Centre-back",
        "Left midfielder",
        "Right-back",
        "Attacking midfielder",
      ],
      correctAnswers: [0, 2],
      timeLimit: 25,
      points: 120,
      metadata: { category: "positions", difficulty: "medium", multi: true },
    },
    {
      text: 'A "hat-trick" in football means:',
      choices: [
        "Three assists by one player",
        "Three saves by a goalkeeper",
        "A player scored three goals in a single match",
        "Three yellow cards to a single player in one game",
      ],
      correctIndex: 2,
      timeLimit: 20,
      points: 90,
      metadata: { category: "terminology", difficulty: "easy" },
    },
    {
      text: 'Which area on the field is also known as the "penalty area"?',
      choices: [
        "The 6-yard box",
        "The half-way line",
        "The 18-yard box",
        "The corner arc",
      ],
      correctIndex: 2,
      timeLimit: 20,
      points: 60,
      metadata: { category: "field", difficulty: "easy" },
    },
  ];

  let inserted = 0;
  let skipped = 0;
  try {
    for (const q of questions) {
      // avoid duplicates by question text
      const exists = await QuestionModel.findOne({ text: q.text }).lean();
      if (exists) {
        skipped++;
        continue;
      }
      await QuestionModel.create(q);
      inserted++;
    }

    console.log(
      `Seeding complete. Inserted: ${inserted}, Skipped (already existed): ${skipped}`,
    );
  } catch (err) {
    console.error("Error seeding questions:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled error in seeding script:", err);
  process.exit(1);
});
