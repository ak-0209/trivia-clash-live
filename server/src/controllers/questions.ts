import { Request, Response } from "express";
import QuestionModel, { IQuestion } from "../models/question";
import RoundModel from "../models/Round";
import Round from "../models/Round";

// Get question by index (1-based) from database
export const getQuestionByIndex = async (req: Request, res: Response) => {
  try {
    const { index } = req.params;
    const questionIndex = parseInt(index) - 1; // Convert to 0-based

    if (questionIndex < 0) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    // Get all active questions sorted by creation date
    const activeQuestions = await QuestionModel.find({ isActive: true })
      .sort({ createdAt: 1 })
      .select("-correctIndex -correctAnswers") // Exclude correct answers for security
      .exec();

    if (questionIndex >= activeQuestions.length) {
      return res.status(404).json({
        error: "Question not found",
        availableQuestions: activeQuestions.length,
        currentIndex: questionIndex + 1,
      });
    }

    const question = activeQuestions[questionIndex];

    // Return safe question data (without correct answers)
    const safeQuestion = {
      id: question._id,
      questionNumber: questionIndex + 1,
      text: question.text,
      choices: question.choices,
      timeLimit: question.timeLimit || 30,
      points: question.points || 100,
    };

    res.json({
      question: safeQuestion,
      totalQuestions: activeQuestions.length,
      currentQuestion: questionIndex + 1,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ error: "Failed to fetch question" });
  }
};

// Get total number of active questions
// export const getTotalQuestions = async (req: Request, res: Response) => {
//   try {
//     const total = await QuestionModel.countDocuments({ isActive: true });
//     res.json({ totalQuestions: total });
//   } catch (error) {
//     console.error("Error counting questions:", error);
//     res.status(500).json({ error: "Failed to count questions" });
//   }
// };

// // Get specific question by ID (for host/admin use - includes correct answers)
// export const getQuestionById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const question = await QuestionModel.findById(id);

//     if (!question) {
//       return res.status(404).json({ error: "Question not found" });
//     }

//     if (!question.isActive) {
//       return res.status(400).json({ error: "Question is not active" });
//     }

//     // For host, include correct answers
//     res.json({
//       question: {
//         id: question._id,
//         text: question.text,
//         choices: question.choices,
//         correctIndex: question.correctIndex,
//         correctAnswers: question.correctAnswers,
//         timeLimit: question.timeLimit,
//         points: question.points,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching question by ID:", error);
//     res.status(500).json({ error: "Failed to fetch question" });
//   }
// };

export const getAllRounds = async (req: Request, res: Response) => {
  try {
    // Get ALL rounds, not just active ones
    const rounds = await Round.find({}).sort({ order: 1 });

    const formattedRounds = rounds.map((round) => ({
      id: round._id,
      name: round.name,
      description: round.description,
      order: round.order,
      isActive: round.isActive,
      totalQuestions: round.totalQuestions,
    }));

    res.json({
      rounds: formattedRounds,
      totalRounds: rounds.length,
      activeRound: rounds.find((r) => r.isActive)?.name || "None",
    });
  } catch (error) {
    console.error("Error fetching rounds:", error);
    res.status(500).json({ error: "Failed to fetch rounds" });
  }
};

// Get round by ID
export const getRoundById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const round = await RoundModel.findById(id);

    if (!round) {
      return res.status(404).json({ error: "Round not found" });
    }

    res.json({ round });
  } catch (error) {
    console.error("Error fetching round:", error);
    res.status(500).json({ error: "Failed to fetch round" });
  }
};

// Get questions by round ID
export const getQuestionsByRoundId = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;

    const questions = await QuestionModel.find({
      roundId,
      isActive: true,
    })
      .sort({ roundIndex: 1 })
      .select("-correctIndex -correctAnswers") // Exclude correct answers for security
      .exec();

    const safeQuestions = questions.map((question, index) => ({
      id: question._id,
      questionNumber: index + 1,
      text: question.text,
      choices: question.choices,
      timeLimit: question.timeLimit || 30,
      points: question.points || 100,
    }));

    res.json({
      questions: safeQuestions,
      totalQuestions: safeQuestions.length,
    });
  } catch (error) {
    console.error("Error fetching questions by round:", error);
    res.status(500).json({ error: "Failed to fetch questions by round" });
  }
};

// Get question by round ID and index
export const getQuestionByRoundAndIndex = async (
  req: Request,
  res: Response,
) => {
  try {
    const { roundId, index } = req.params;
    const questionIndex = parseInt(index) - 1; // Convert to 0-based

    if (questionIndex < 0) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    // Get all active questions for this round, sorted by roundIndex
    const roundQuestions = await QuestionModel.find({
      roundId,
      isActive: true,
    })
      .sort({ roundIndex: 1 })
      .select("-correctIndex -correctAnswers") // Exclude correct answers for security
      .exec();

    if (questionIndex >= roundQuestions.length) {
      return res.status(404).json({
        error: "Question not found",
        availableQuestions: roundQuestions.length,
        currentIndex: questionIndex + 1,
      });
    }

    const question = roundQuestions[questionIndex];

    // Return safe question data (without correct answers)
    const safeQuestion = {
      id: question._id,
      questionNumber: questionIndex + 1,
      text: question.text,
      choices: question.choices,
      timeLimit: question.timeLimit || 30,
      points: question.points || 100,
    };

    res.json({
      question: safeQuestion,
      totalQuestions: roundQuestions.length,
      currentQuestion: questionIndex + 1,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ error: "Failed to fetch question" });
  }
};

// Get total number of active questions (all rounds)
export const getTotalQuestions = async (req: Request, res: Response) => {
  try {
    const total = await QuestionModel.countDocuments({ isActive: true });
    res.json({ totalQuestions: total });
  } catch (error) {
    console.error("Error counting questions:", error);
    res.status(500).json({ error: "Failed to count questions" });
  }
};

// Get total number of active questions by round
export const getTotalQuestionsByRound = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;
    const total = await QuestionModel.countDocuments({
      roundId,
      isActive: true,
    });
    res.json({ totalQuestions: total });
  } catch (error) {
    console.error("Error counting questions by round:", error);
    res.status(500).json({ error: "Failed to count questions by round" });
  }
};

// Get specific question by ID (for host/admin use - includes correct answers)
export const getQuestionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const question = await QuestionModel.findById(id).populate("roundId");

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (!question.isActive) {
      return res.status(400).json({ error: "Question is not active" });
    }

    // For host, include correct answers
    res.json({
      question: {
        id: question._id,
        text: question.text,
        choices: question.choices,
        correctIndex: question.correctIndex,
        correctAnswers: question.correctAnswers,
        timeLimit: question.timeLimit,
        points: question.points,
        roundId: question.roundId,
        roundIndex: question.roundIndex,
      },
    });
  } catch (error) {
    console.error("Error fetching question by ID:", error);
    res.status(500).json({ error: "Failed to fetch question by ID" });
  }
};
