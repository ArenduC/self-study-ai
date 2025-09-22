import React, { useState, useCallback, useRef } from 'react';
import { Course, Level, Quiz, QuizQuestion, generateNewQuiz, QuizAttempt } from '../services/geminiService';
import QuizDisplay from './QuizDisplay';
import StudySuggestionsDisplay from './StudySuggestionsDisplay';
import { Loader } from './Loader';
import { Icon } from './Icon';

// --- Level Display Component ---
const LevelDisplay: React.FC<{
    level: Level;
    onQuizComplete: (quizId: string, score: number) => void;
    onRegenerateQuiz: () => Promise<void>;
}> = ({ level, onQuizComplete, onRegenerateQuiz }) => {
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const activeQuizData = level.quizzes.find(q => q.quizId === activeQuizId);

    const handleQuizCompletion = (score: number) => {
        if (activeQuizId) onQuizComplete(activeQuizId, score);
        setActiveQuizId(null);
    };
    
    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try { await onRegenerateQuiz(); } 
        finally { setIsRegenerating(false); }
    };

    if (activeQuizData) {
        return (
            <div className="p-4 sm:p-6 md:p-8">
                <button onClick={() => setActiveQuizId(null)} className="mb-6 text-sm font-medium text-accent hover:opacity-80 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Level Overview
                </button>
                <QuizDisplay 
                    quiz={activeQuizData.questions} 
                    onQuizComplete={handleQuizCompletion} 
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-4 text-text-dark dark:text-background">{level.levelTitle}</h2>
            <div className="prose prose-sm sm:prose-base max-w-none mb-8 bg-gray-50 dark:bg-text-dark p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center text-text-dark dark:text-background"><Icon name="book-open" className="w-5 h-5 mr-2" />Summary</h3>
                {level.imageUrl && <div className="my-4"><img src={level.imageUrl} alt={`Illustration for ${level.levelTitle}`} className="w-full max-w-md mx-auto rounded-lg shadow-md" /></div>}
                <p className="text-text-dark dark:text-background">{level.summary}</p>
            </div>
            <div className="my-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-text-dark dark:text-background"><Icon name="academic-cap" className="w-5 h-5 mr-2" />Tests for this Level</h3>
                <div className="space-y-3 bg-white dark:bg-[#4A2554] border border-gray-200 dark:border-primary rounded-lg p-4">
                    {level.quizzes.map((quiz, index) => (
                        <div key={quiz.quizId} className="flex items-center justify-between p-3 even:bg-gray-50 dark:even:bg-text-dark rounded-md">
                            <div>
                                <p className="font-semibold text-text-dark dark:text-background">{index === 0 ? 'Initial Knowledge Check' : `Practice Test ${index + 1}`}</p>
                                {quiz.status === 'completed' ? <p className="text-sm text-green-600 font-medium">Completed - Score: {quiz.score}/{quiz.questions.length}</p> : <p className="text-sm text-gray-500 dark:text-primary-light">Not yet taken</p>}
                            </div>
                            <button onClick={() => setActiveQuizId(quiz.quizId)} className="bg-white dark:bg-[#4A2554] text-accent border border-accent font-bold py-2 px-4 rounded-md hover:bg-primary-light dark:hover:bg-text-dark text-sm transition-colors shrink-0 ml-2">
                                {quiz.status === 'completed' ? 'Review' : 'Start Test'}
                            </button>
                        </div>
                    ))}
                     <div className="pt-4 mt-4 border-t dark:border-primary">
                        <button onClick={handleRegenerate} disabled={isRegenerating} className="w-full flex items-center justify-center bg-gray-100 dark:bg-text-dark text-text-dark dark:text-background font-bold py-2 px-4 rounded-md hover:bg-gray-200 dark:hover:bg-[#5A3564] text-sm transition-colors disabled:opacity-50">
                            {isRegenerating ? <><Loader /><span className="ml-2">Generating...</span></> : <><Icon name="plus" className="w-4 h-4 mr-2" /><span>Generate New Practice Test</span></>}
                        </button>
                    </div>
                </div>
            </div>
            <StudySuggestionsDisplay references={level.references} />
        </div>
    );
};


// --- Course Display Component ---
interface CourseDisplayProps {
  course: Course;
  setCourse: (course: Course) => void;
  onBackToDashboard: () => void;
  onAddPdf: (course: Course, file: File) => Promise<void>;
  isAddingContent: boolean;
  addContentError: string | null;
  addContentProgressMessage: string;
  clearAddContentError: () => void;
}

const CourseDisplay: React.FC<CourseDisplayProps> = ({ course, setCourse, onBackToDashboard, onAddPdf, isAddingContent, addContentError, addContentProgressMessage, clearAddContentError }) => {
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [quizError, setQuizError] = useState<string | null>(null);
    const addPdfInputRef = useRef<HTMLInputElement>(null);

    const handleQuizComplete = useCallback((quizId: string, score: number) => {
        const newCourse = { ...course };
        const levelToUpdate = { ...newCourse.levels[currentLevelIndex] };
        const quizIndex = levelToUpdate.quizzes.findIndex(q => q.quizId === quizId);
        if (quizIndex === -1) return;

        const quizToUpdate = { ...levelToUpdate.quizzes[quizIndex], status: 'completed' as const, score };
        
        // --- Create History Record ---
        const newAttempt: QuizAttempt = {
            attemptId: `att-${Date.now()}`,
            quizId: quizId,
            levelId: levelToUpdate.levelId,
            levelTitle: levelToUpdate.levelTitle,
            score: score,
            totalQuestions: quizToUpdate.questions.length,
            percentage: (score / quizToUpdate.questions.length) * 100,
            timestamp: Date.now()
        };
        newCourse.history = [...(newCourse.history || []), newAttempt];
        // --- End History Record ---

        levelToUpdate.quizzes = [...levelToUpdate.quizzes];
        levelToUpdate.quizzes[quizIndex] = quizToUpdate;

        const isFirstQuiz = quizIndex === 0;
        if (isFirstQuiz && levelToUpdate.status !== 'completed') {
            levelToUpdate.status = 'completed';
        }
        
        newCourse.levels[currentLevelIndex] = levelToUpdate;
        
        const completedCount = newCourse.levels.filter(l => l.status === 'completed').length;
        newCourse.progress = Math.round((completedCount / newCourse.levels.length) * 100);

        setCourse(newCourse);

        if (isFirstQuiz && currentLevelIndex < newCourse.levels.length - 1) {
            setCurrentLevelIndex(currentLevelIndex + 1);
        }
    }, [course, currentLevelIndex, setCourse]);

    const handleRegenerateQuiz = useCallback(async () => {
        setQuizError(null);
        const currentLevel = course.levels[currentLevelIndex];
        try {
            const newQuizQuestions = await generateNewQuiz(currentLevel.summary, currentLevel.levelTitle);
            const newQuiz: Quiz = {
                quizId: `quiz-${Date.now()}`,
                questions: newQuizQuestions,
                status: 'not-started'
            };

            const updatedCourse = { ...course };
            const updatedLevels = [...updatedCourse.levels];
            const levelToUpdate = { ...updatedLevels[currentLevelIndex] };
            levelToUpdate.quizzes = [...levelToUpdate.quizzes, newQuiz];
            updatedLevels[currentLevelIndex] = levelToUpdate;
            updatedCourse.levels = updatedLevels;

            setCourse(updatedCourse);
        } catch (e: any) {
            console.error("Failed to generate new quiz:", e);
            setQuizError(e.message || "Could not generate a new quiz. Please try again.");
        }
    }, [course, currentLevelIndex, setCourse]);
    
    const handleAddPdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await onAddPdf(course, file);
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const isLevelUnlocked = (levelIndex: number) => {
        if (levelIndex === 0) return true;
        return course.levels[levelIndex - 1].status === 'completed';
    };
    
    const isCourseComplete = course.progress === 100;

    return (
        <div className="flex flex-col md:flex-row bg-white dark:bg-[#4A2554] rounded-lg shadow-lg overflow-hidden min-h-[80vh]">
            <div className="w-full md:w-1/3 lg:w-1/4 bg-gray-50 dark:bg-text-dark border-b md:border-b-0 md:border-r border-gray-200 dark:border-primary p-6 flex flex-col">
                <div>
                    <h2 className="text-xl font-bold text-text-dark dark:text-background mb-2">{course.courseTitle}</h2>
                    <p className="text-sm text-gray-500 dark:text-primary-light mb-4">Your personalized learning path.</p>
                    <div className="w-full bg-gray-200 dark:bg-[#4A2554] rounded-full h-2.5 mb-4">
                        <div className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${course.progress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-primary-light text-center mb-6">{course.progress}% Complete</p>
                    <nav className="space-y-2">
                        {course.levels.map((level, index) => {
                            const unlocked = isLevelUnlocked(index);
                            const active = index === currentLevelIndex;
                            const completed = level.status === 'completed';
                            return (
                                <button key={level.levelId} onClick={() => unlocked && setCurrentLevelIndex(index)} disabled={!unlocked} className={`w-full text-left flex items-center p-3 rounded-md text-sm font-medium transition-colors ${active ? 'bg-primary-light text-accent dark:bg-primary dark:text-text-dark' : unlocked ? 'text-text-dark dark:text-background hover:bg-gray-200 dark:hover:bg-[#4A2554]' : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 text-xs font-bold shrink-0 ${completed ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-[#4A2554]'}`}>
                                        {completed ? <Icon name="check" className="w-4 h-4" /> : index + 1}
                                    </div>
                                    <div className="flex-grow flex items-center justify-between min-w-0">
                                      <span className="truncate pr-2">{level.levelTitle}</span>
                                      {level.imageUrl && <Icon name="image" className="w-4 h-4 text-gray-400 shrink-0" />}
                                    </div>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto border-t dark:border-primary pt-6 space-y-4">
                    <input type="file" accept="application/pdf" ref={addPdfInputRef} onChange={handleAddPdfFileChange} className="hidden" />
                    <button onClick={() => addPdfInputRef.current?.click()} disabled={isAddingContent} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 text-sm transition-colors flex items-center justify-center disabled:bg-gray-400">
                       {isAddingContent ? <Loader /> : <Icon name="plus" className="w-4 h-4 mr-2" />}
                       <span>{isAddingContent ? 'Adding...' : 'Add PDF Content'}</span>
                    </button>
                    <button onClick={onBackToDashboard} className="w-full bg-gray-200 dark:bg-[#4A2554] text-text-dark dark:text-background font-bold py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-[#5A3564] text-sm transition-colors">
                        Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="w-full md:w-2/3 lg:w-3/4 overflow-y-auto">
                 {addContentError && (
                    <div className="m-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm flex justify-between items-center">
                        <p><span className="font-bold">Error:</span> {addContentError}</p>
                        <button onClick={clearAddContentError}><Icon name="x" className="w-5 h-5" /></button>
                    </div>
                 )}
                 {isAddingContent && addContentProgressMessage && (
                     <div className="m-4 p-3 bg-primary-light dark:bg-text-dark text-text-dark dark:text-background border border-primary rounded-md text-sm flex items-center">
                         <Loader /> <span className="ml-3">{addContentProgressMessage}</span>
                     </div>
                 )}
                {!isCourseComplete ? (
                    <>
                        {quizError && (
                            <div className="m-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm">
                                <p><span className="font-bold">Error:</span> {quizError}</p>
                            </div>
                        )}
                        <LevelDisplay 
                            level={course.levels[currentLevelIndex]} 
                            onQuizComplete={(quizId, score) => handleQuizComplete(quizId, score)} 
                            onRegenerateQuiz={handleRegenerateQuiz}
                        />
                    </>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center h-full">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-green-600 mb-4">Congratulations!</h2>
                            <p className="text-lg text-gray-600 dark:text-primary-light mb-8">You've completed the course. Here's what you can explore next.</p>
                        </div>
                        <div className="text-left max-w-xl w-full mx-auto bg-gray-50 dark:bg-text-dark p-6 rounded-lg border dark:border-primary">
                           <StudySuggestionsDisplay references={{
                               articles: [],
                               videos: [],
                               caseStudies: course.nextSteps.advancedMaterial,
                           }} />
                           
                           {course.nextSteps.advancedMaterial.length > 0 && course.nextSteps.relatedTopics.length > 0 && <div className="border-t dark:border-primary my-6"></div>}

                           {course.nextSteps.relatedTopics.length > 0 && (
                               <div>
                                   <h4 className="text-lg font-semibold mb-3 flex items-center text-text-dark dark:text-background">
                                       <Icon name="lightbulb" className="w-5 h-5 mr-2" />
                                       Explore Related Topics
                                   </h4>
                                   <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-dark dark:text-background">
                                       {course.nextSteps.relatedTopics.map(topic => <li key={topic}>{topic}</li>)}
                                   </ul>
                               </div>
                           )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseDisplay;