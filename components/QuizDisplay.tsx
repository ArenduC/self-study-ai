import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../services/geminiService';
import { Icon } from './Icon';

interface QuizDisplayProps {
  quiz: QuizQuestion[];
  onQuizComplete?: (score: number) => void;
  onBack?: () => void; // Optional callback to go back
}

const QuizDisplay: React.FC<QuizDisplayProps> = ({ quiz, onQuizComplete, onBack }) => {
  const [userAnswers, setUserAnswers] = useState<string[]>(Array(quiz.length).fill(''));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setUserAnswers(Array(quiz.length).fill(''));
    setSubmitted(false);
  }, [quiz]);

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    if (submitted) return;
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const calculateScore = () => {
    return userAnswers.reduce((score, userAnswer, index) => {
      if (userAnswer === quiz[index].answer) {
        return score + 1;
      }
      return score;
    }, 0);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    if (onQuizComplete) {
      onQuizComplete(calculateScore());
    }
  };

  const getOptionClasses = (option: string, questionIndex: number) => {
    const baseClasses = 'bg-gray-100 dark:bg-[#4A2554]';
    if (!submitted) {
        return `hover:bg-primary-light dark:hover:bg-[#5A3564] ${userAnswers[questionIndex] === option ? 'bg-primary ring-2 ring-accent' : baseClasses}`;
    }

    const correctAnswer = quiz[questionIndex].answer;
    const userAnswer = userAnswers[questionIndex];

    if (option === correctAnswer) {
      return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-white ring-2 ring-green-500';
    }
    if (option === userAnswer && option !== correctAnswer) {
      return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-white ring-2 ring-red-500';
    }
    return `${baseClasses} dark:text-background`;
  };
  
  const allQuestionsAnswered = userAnswers.every(answer => answer !== '');

  return (
    <div className="space-y-6">
      {quiz.map((q, index) => (
            <div key={index} className="border border-gray-200 dark:border-primary p-4 rounded-lg">
                <p className="font-semibold mb-3 text-text-dark dark:text-background">{index + 1}. {q.question}</p>
              {q.imageUrl && (
                <div className="mb-4">
                  <img src={q.imageUrl} alt={`Quiz image for question ${index + 1}`} className="w-full max-w-sm mx-auto rounded-md border" />
                </div>
              )}
              <div className="space-y-2">
                {q.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    onClick={() => handleAnswerChange(index, option)}
                    disabled={submitted}
                    className={`w-full text-left p-3 rounded-md transition-colors text-sm flex items-center text-text-dark dark:text-background ${getOptionClasses(option, index)} disabled:cursor-not-allowed`}
                  >
                    <span className="flex-grow">{option}</span>
                    {submitted && option === quiz[index].answer && <Icon name="check" className="w-5 h-5 text-green-700 dark:text-green-300" />}
                    {submitted && userAnswers[index] === option && option !== quiz[index].answer && <Icon name="x" className="w-5 h-5 text-red-700 dark:text-red-300" />}
                  </button>
                ))}
              </div>
            </div>
        ))}
      {!submitted && (
        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered}
            className="bg-accent text-white font-bold py-2 px-6 rounded-md hover:opacity-90 disabled:bg-gray-400 disabled:dark:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Check Answers
          </button>
          {!allQuestionsAnswered && <p className="text-xs text-gray-500 dark:text-primary-light mt-2">Please answer all questions to see your score.</p>}
        </div>
      )}
      {submitted && (
        <div className="mt-6 text-center p-4 bg-primary-light dark:bg-text-dark border border-primary rounded-lg">
          <h3 className="text-lg font-bold text-text-dark dark:text-background">Test Complete!</h3>
          <p className="text-2xl mt-2 text-text-dark dark:text-background">
            You scored {calculateScore()} out of {quiz.length}
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 bg-primary text-text-dark font-bold py-2 px-4 rounded-md hover:opacity-90 transition-colors"
            >
                Play Again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizDisplay;