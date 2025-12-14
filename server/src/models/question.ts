import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * IQuestion - attributes for a trivia question
 *
 * Fields explained:
 * - text: The question text shown to players.
 * - choices: Array of possible answer strings (order matters).
 * - correctIndex: Index into `choices` for single-answer questions.
 * - correctAnswers: Array of indexes for multi-answer questions.
 * - category: Optional category or topic for grouping/filtering.
 * - difficulty: Tag to help balancing and filtering questions.
 * - timeLimit: Seconds allowed to answer this question.
 * - points: Base points awarded for a correct answer.
 * - isActive: Whether question is available for use.
 * - roundId: Reference to the round this question belongs to.
 * - roundIndex: Index of the question within its round.
 * - metadata: Arbitrary key/value for extra info (images, source, tags).
 */
export interface IQuestion {
  text: string;
  choices: string[];
  correctIndex?: number;
  correctAnswers?: number[];
  timeLimit?: number;
  points?: number;
  isActive?: boolean;
  roundId?: mongoose.Types.ObjectId;
  roundIndex?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QuestionDoc extends Document, IQuestion {}

const QuestionSchema = new Schema<QuestionDoc>(
  {
    text: { type: String, required: true },
    choices: { type: [String], required: true },
    correctIndex: { type: Number },
    correctAnswers: { type: [Number], default: [] },
    timeLimit: { type: Number, default: 30 },
    points: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round" },
    roundIndex: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Avoid model overwrite errors in dev / watch mode
const QuestionModel: Model<QuestionDoc> =
  (mongoose.models as any).Question ||
  mongoose.model<QuestionDoc>("Question", QuestionSchema);

export default QuestionModel;
