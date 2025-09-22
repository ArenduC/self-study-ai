import React, { useState, useRef, useCallback } from 'react';
import { Course, QuizAttempt } from '../services/geminiService';
import { Icon } from './Icon';
import { Loader } from './Loader';
import { extractPdfContent } from '../services/pdfService';
import { generateCourse as generateFullCourse, generateCourseFromManualLevels } from '../services/geminiService';
import WorldExplorer from './WorldExplorer'; // Import the new component

type Difficulty = 'Beginner' | 'Advanced';
type CreationMode = 'auto' | 'manual' | null;
type ManualLevel = { id: string; title: string; };
type PdfContent = { text: string; images: string[]; };

// --- History Modal Component ---
const HistoryModal: React.FC<{ course: Course; onClose: () => void; }> = ({ course, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-[#4A2554] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-primary flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-text-dark dark:text-background">Attempt History: {course.courseTitle}</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-primary-light hover:text-gray-600 dark:hover:text-background">
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {course.history.length > 0 ? (
                        <div className="space-y-4">
                            {course.history.map(attempt => (
                                <div key={attempt.attemptId} className="border border-gray-200 dark:border-primary rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                    <div className="mb-2 sm:mb-0">
                                        <p className="font-semibold text-text-dark dark:text-background">{attempt.levelTitle}</p>
                                        <p className="text-xs text-gray-500 dark:text-primary-light">{new Date(attempt.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm">
                                        <span className="font-medium text-gray-600 dark:text-primary-light">Score: {attempt.score}/{attempt.totalQuestions}</span>
                                        <span className={`font-bold px-2 py-1 rounded-md text-xs ${attempt.percentage >= 70 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {attempt.percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-primary-light py-8">No quiz attempts have been recorded for this course yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Manual Course Editor Component (encapsulated within Dashboard) ---
const ManualCourseEditor: React.FC<{
    pdfContent: PdfContent;
    difficulty: Difficulty;
    onGenerate: (course: Course) => void;
    onError: (message: string) => void;
    setIsLoading: (loading: boolean) => void;
    setProgressMessage: (message: string) => void;
    onCancel: () => void;
}> = ({ pdfContent, difficulty, onGenerate, onError, setIsLoading, setProgressMessage, onCancel }) => {
    const [courseTitle, setCourseTitle] = useState('');
    const [levels, setLevels] = useState<ManualLevel[]>([{ id: `lvl-${Date.now()}`, title: '' }]);
    const draggedItem = useRef<number | null>(null);
    const draggedOverItem = useRef<number | null>(null);

    const handleAddLevel = () => setLevels([...levels, { id: `lvl-${Date.now()}`, title: '' }]);
    const handleRemoveLevel = (id: string) => setLevels(levels.filter(level => level.id !== id));
    const handleLevelTitleChange = (id: string, newTitle: string) => setLevels(levels.map(level => level.id === id ? { ...level, title: newTitle } : level));
    
    const handleSort = () => {
        if (draggedItem.current === null || draggedOverItem.current === null) return;
        const levelsClone = [...levels];
        const temp = levelsClone[draggedItem.current];
        levelsClone.splice(draggedItem.current, 1);
        levelsClone.splice(draggedOverItem.current, 0, temp);
        setLevels(levelsClone);
        draggedItem.current = null;
        draggedOverItem.current = null;
    };

    const handleGenerateContent = async () => {
        if (courseTitle.trim() === '') {
            onError("Please provide a course title.");
            return;
        }
        if (levels.some(l => l.title.trim() === '')) {
            onError("Please provide a title for all levels.");
            return;
        }
        if (levels.length === 0) {
            onError("Please add at least one level.");
            return;
        }

        setIsLoading(true);
        try {
            const { text, images } = pdfContent;
            const generatedCourse = await generateCourseFromManualLevels(text, images, courseTitle, levels, difficulty, setProgressMessage);
            onGenerate(generatedCourse);
        } catch (e: any) {
            onError(e.message || 'An unknown error occurred while generating content.');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };
    
    return (
        <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-text-dark dark:text-background">Create Your Course Outline</h2>
            <div className="mb-4">
                <label htmlFor="courseTitle" className="block text-sm font-medium text-gray-700 dark:text-primary-light mb-1">Course Title</label>
                <input type="text" id="courseTitle" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g., Biology - The Process of Photosynthesis" className="w-full p-2 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md focus:ring-accent focus:border-accent text-text-dark dark:text-background"/>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-primary-light mb-1">Levels / Modules</label>
                <div className="space-y-2">{levels.map((level, index) => (
                    <div key={level.id} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-text-dark rounded-md" draggable onDragStart={() => (draggedItem.current = index)} onDragEnter={() => (draggedOverItem.current = index)} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()}>
                        <span className="cursor-move text-gray-400 dark:text-primary-light"><Icon name="drag-handle" className="w-5 h-5" /></span>
                        <input type="text" value={level.title} onChange={(e) => handleLevelTitleChange(level.id, e.target.value)} placeholder={`Level ${index + 1} Title`} className="flex-grow p-1 border border-primary-light dark:border-primary bg-white dark:bg-[#4A2554] rounded-md text-sm text-text-dark dark:text-background"/>
                        <button onClick={() => handleRemoveLevel(level.id)} className="text-red-500 hover:text-red-700 p-1"><Icon name="trash" className="w-5 h-5" /></button>
                    </div>
                ))}</div>
            </div>

            <button onClick={handleAddLevel} className="flex items-center text-sm text-accent hover:opacity-80 font-medium mb-6"><Icon name="plus" className="w-4 h-4 mr-1" /> Add Level</button>
            
            <div className="flex justify-between items-center">
                <button onClick={onCancel} className="text-sm text-gray-500 dark:text-primary-light hover:text-text-dark dark:hover:text-background">Cancel</button>
                <button onClick={handleGenerateContent} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition-colors">Generate Content</button>
            </div>
        </div>
    );
};


// --- Main Dashboard Component ---
interface DashboardProps {
  courses: Course[];
  onCreateCourse: (course: Course) => void;
  onSelectCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  activeView: 'courses' | 'explorer';
  setActiveView: (view: 'courses' | 'explorer') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ courses, onCreateCourse, onSelectCourse, onDeleteCourse, activeView, setActiveView }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [pdfContent, setPdfContent] = useState<PdfContent | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [creationMode, setCreationMode] = useState<CreationMode>(null);
    const [viewingHistory, setViewingHistory] = useState<Course | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Beginner' | 'Advanced'>('All');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReset = () => {
        setIsCreating(false);
        setFile(null);
        setPdfContent(null);
        setError(null);
        setIsLoading(false);
        setProgressMessage('');
        setCreationMode(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        if (selectedFile.type !== 'application/pdf') {
            setError('Please upload a valid PDF file.');
            setFile(null);
            return;
        }
        
        setFile(selectedFile);
        setError(null);
        setCreationMode(null);
        setPdfContent(null);

        setIsLoading(true);
        setProgressMessage('Extracting text and images from your PDF...');
        try {
            const content = await extractPdfContent(selectedFile);
            if (content.text.trim().length < 100) {
                throw new Error("Could not extract enough text to create a course. The PDF might be image-based or too short.");
            }
            setPdfContent(content);
        } catch(e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };
    
    const handleAutoCreateCourse = useCallback(async () => {
        if (!pdfContent) {
            setError('PDF content not processed yet.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            setProgressMessage('Building your personalized course with Gemini...');
            const generatedCourse = await generateFullCourse(pdfContent.text, pdfContent.images, difficulty);
            onCreateCourse(generatedCourse); // Pass to parent
            handleReset(); // Reset local state after creation
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    }, [pdfContent, difficulty, onCreateCourse]);

    const handleManualCourseCreated = (course: Course) => {
        onCreateCourse(course);
        handleReset();
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const renderCreationFlow = () => {
        if (isLoading) {
             return (
                <div className="mt-6 flex items-center justify-center flex-col bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-md">
                    <Loader />
                    <p className="mt-4 text-lg text-gray-600 dark:text-primary-light">{progressMessage || 'Loading...'}</p>
                </div>
            );
        }
        if (error) {
            return (
                <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-md max-w-2xl mx-auto">
                    <p><span className="font-bold">Error:</span> {error}</p>
                    <button onClick={handleReset} className="mt-2 text-sm font-semibold text-red-800 hover:underline">Start Over</button>
                </div>
            );
        }
        if (pdfContent && creationMode === 'manual') {
            return <ManualCourseEditor pdfContent={pdfContent} difficulty={difficulty} onGenerate={handleManualCourseCreated} onError={setError} setIsLoading={setIsLoading} setProgressMessage={setProgressMessage} onCancel={handleReset} />;
        }
        if (pdfContent) {
            return (
                 <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md max-w-2xl mx-auto">
                     <div className="text-center mb-6">
                        <h2 className="text-xl font-semibold mb-2 text-text-dark dark:text-background">Your PDF is Ready!</h2>
                        <p className="text-gray-600 dark:text-primary-light">"{file?.name}" has been processed.</p>
                     </div>
                    <div className="mt-6 border-t dark:border-primary pt-6">
                        <h3 className="text-lg font-semibold text-center mb-4 text-text-dark dark:text-background">Choose your creation method</h3>
                         <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                            <div className="flex items-center space-x-2">
                                <label htmlFor="difficulty" className="text-sm font-medium text-gray-700 dark:text-primary-light">Difficulty:</label>
                                <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="p-1 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md text-sm focus:ring-accent focus:border-accent text-text-dark dark:text-background">
                                    <option value="Beginner">Beginner</option>
                                    <option value="Advanced">Advanced</option>
                                </select>
                            </div>
                            <button onClick={handleReset} className="text-sm text-gray-500 dark:text-primary-light hover:text-text-dark dark:hover:text-background">Cancel</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={handleAutoCreateCourse} className="w-full bg-accent text-white font-bold py-3 px-4 rounded-md hover:opacity-90">Auto-Generate Course</button>
                             <button onClick={() => setCreationMode('manual')} className="w-full bg-primary text-text-dark font-bold py-3 px-4 rounded-md hover:opacity-90">Create Manually</button>
                        </div>
                    </div>
                </div>
            )
        }
        return (
            <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold mb-4 text-text-dark dark:text-background">Create a New Course</h2>
                <div className="border-2 border-dashed border-gray-300 dark:border-primary rounded-lg p-8 text-center cursor-pointer hover:border-accent dark:hover:border-accent hover:bg-primary-light dark:hover:bg-text-dark" onClick={triggerFileInput}>
                    <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" ref={fileInputRef}/>
                    <div className="flex flex-col items-center">
                        <Icon name="upload" className="w-12 h-12 text-gray-400 dark:text-primary-light mb-2" />
                        <p className="text-gray-700 dark:text-background">Click to browse or drop PDF here</p>
                    </div>
                </div>
                <div className="text-center mt-4">
                     <button onClick={handleReset} className="text-sm text-gray-500 dark:text-primary-light hover:text-text-dark dark:hover:text-background">Cancel</button>
                </div>
            </div>
        );
    }

    const filteredCourses = courses.filter(course => {
        const courseDifficulty = course.difficulty || 'Beginner'; // Default for legacy courses
        const matchesSearch = course.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDifficulty = difficultyFilter === 'All' || courseDifficulty === difficultyFilter;
        return matchesSearch && matchesDifficulty;
    });
    
    if (isCreating) {
        return renderCreationFlow();
    }

    const CourseListView = () => (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-text-dark dark:text-background">My Courses</h2>
                <button onClick={() => setIsCreating(true)} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90 flex items-center">
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    New Course
                </button>
            </div>
            {courses.length > 0 && (
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder="Search courses by title..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md focus:ring-accent focus:border-accent text-text-dark dark:text-background"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icon name="search" className="w-5 h-5 text-gray-400 dark:text-primary-light" />
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={difficultyFilter}
                            onChange={(e) => setDifficultyFilter(e.target.value as 'All' | 'Beginner' | 'Advanced')}
                            className="w-full sm:w-auto p-2 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md focus:ring-accent focus:border-accent appearance-none pr-8 text-text-dark dark:text-background"
                        >
                            <option value="All">All Difficulties</option>
                            <option value="Beginner">Beginner</option>
                            <option value="Advanced">Advanced</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400 dark:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            )}
            {courses.length > 0 ? (
                filteredCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCourses.map(course => {
                            const totalAttempts = course.history?.length || 0;
                            const averageScore = totalAttempts > 0 
                                ? course.history.reduce((acc, attempt) => acc + attempt.percentage, 0) / totalAttempts
                                : 0;
                            const difficulty = course.difficulty || 'Beginner';

                            return (
                                <div key={course.courseId} className="bg-white dark:bg-[#4A2554] rounded-lg shadow-md p-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-dark dark:text-background truncate">{course.courseTitle}</h3>
                                        <div className="flex justify-between items-center mt-1 mb-4">
                                            <p className="text-sm text-gray-500 dark:text-primary-light">{course.levels.length} {course.levels.length === 1 ? 'level' : 'levels'}</p>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${difficulty === 'Beginner' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>{difficulty}</span>
                                        </div>
                                        
                                        <div className="mb-4 space-y-2">
                                            <div>
                                                <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-primary-light mb-1">
                                                    <span>Progress</span>
                                                    <span>{course.progress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-text-dark rounded-full h-2.5">
                                                    <div className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${course.progress}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-600 dark:text-primary-light pt-2 border-t dark:border-primary">
                                                <span>Avg. Score: <span className="font-bold">{averageScore.toFixed(0)}%</span></span>
                                                <span>Attempts: <span className="font-bold">{totalAttempts}</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center space-x-1">
                                             <button onClick={() => setViewingHistory(course)} aria-label={`View history for ${course.courseTitle}`} className="text-gray-400 dark:text-primary-light hover:text-accent p-2 rounded-full transition-colors">
                                                <Icon name="history" className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => onDeleteCourse(course.courseId)} aria-label={`Delete course ${course.courseTitle}`} className="text-gray-400 dark:text-primary-light hover:text-red-600 p-2 rounded-full transition-colors">
                                                <Icon name="trash" className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <button onClick={() => onSelectCourse(course.courseId)} className="bg-primary-light text-text-dark font-semibold py-2 px-4 rounded-md hover:bg-primary dark:bg-primary dark:hover:opacity-90 text-sm">
                                            Open Course
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold text-text-dark dark:text-background">No Courses Found</h3>
                        <p className="text-gray-500 dark:text-primary-light mt-2">No courses match your current search and filter settings.</p>
                    </div>
                )
            ) : (
                <div className="text-center bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-text-dark dark:text-background">No courses yet!</h3>
                    <p className="text-gray-500 dark:text-primary-light mt-2 mb-6">Click "New Course" to get started by uploading a PDF.</p>
                    <button onClick={() => setIsCreating(true)} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90">
                        Create Your First Course
                    </button>
                </div>
            )}
        </>
    );

    return (
        <div>
            {viewingHistory && <HistoryModal course={viewingHistory} onClose={() => setViewingHistory(null)} />}
            
            <div className="mb-6 border-b border-gray-200 dark:border-primary">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveView('courses')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeView === 'courses' ? 'border-accent text-accent' : 'border-transparent text-gray-500 dark:text-primary-light hover:text-gray-700 dark:hover:text-background hover:border-gray-300 dark:hover:border-primary'}`}
                    >
                        My Courses
                    </button>
                    <button
                        onClick={() => setActiveView('explorer')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeView === 'explorer' ? 'border-accent text-accent' : 'border-transparent text-gray-500 dark:text-primary-light hover:text-gray-700 dark:hover:text-background hover:border-gray-300 dark:hover:border-primary'}`}
                    >
                        World Explorer
                    </button>
                </nav>
            </div>

            {activeView === 'courses' ? <CourseListView /> : <WorldExplorer />}
        </div>
    );
};

export default Dashboard;