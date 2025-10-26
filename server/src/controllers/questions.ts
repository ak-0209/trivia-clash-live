import { Request, Response } from "express";
import QuestionModel, { IQuestion } from "../models/question";

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
export const getTotalQuestions = async (req: Request, res: Response) => {
  try {
    const total = await QuestionModel.countDocuments({ isActive: true });
    res.json({ totalQuestions: total });
  } catch (error) {
    console.error("Error counting questions:", error);
    res.status(500).json({ error: "Failed to count questions" });
  }
};

// Get specific question by ID (for host/admin use - includes correct answers)
export const getQuestionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const question = await QuestionModel.findById(id);

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
      },
    });
  } catch (error) {
    console.error("Error fetching question by ID:", error);
    res.status(500).json({ error: "Failed to fetch question" });
  }
};
