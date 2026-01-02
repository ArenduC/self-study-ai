
import React, { useState, useEffect, useCallback } from 'react';
import { Course, Level } from './services/geminiService';
import { extractPdfContent } from './services/pdfService';
import { generateAdditionalLevels } from './services/geminiService';
import Dashboard from './components/Dashboard';
import CourseDisplay from './components/CourseDisplay';
import IntroPage from './components/IntroPage';
import { loadCourses, saveCourses } from './services/courseStore';
import { Icon } from './components/Icon';

const App: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>(() => loadCourses());
    const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [activeView, setActiveView] = useState<'intro' | 'courses' | 'explorer'>(() => {
        const savedCourses = loadCourses();
        return savedCourses.length > 0 ? 'courses' : 'intro';
    });
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

    // Apply theme class to HTML element
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Save courses to localStorage whenever they change
    useEffect(() => {
        saveCourses(courses);
    }, [courses]);

    const handleCreateCourse = (newCourse: Course) => {
        const updatedCourses = [...courses, newCourse];
        setCourses(updatedCourses);
        setActiveCourseId(newCourse.courseId);
        setActiveView('courses');
    };

    const handleUpdateCourse = (updatedCourse: Course) => {
        setCourses(prevCourses =>
            prevCourses.map(c => c.courseId === updatedCourse.courseId ? updatedCourse : c)
        );
    };

    const handleDeleteCourse = (courseId: string) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            const updated = courses.filter(c => c.courseId !== courseId);
            setCourses(updated);
            if (activeCourseId === courseId) {
                setActiveCourseId(null);
            }
            if (updated.length === 0) {
                setActiveView('intro');
            }
        }
    };
    
    const handleAddPdfToCourse = useCallback(async (course: Course, file: File) => {
        setIsLoading(true);
        setError(null);
        setProgressMessage('Processing new PDF...');
        try {
            const { text, images } = await extractPdfContent(file);
             if (text.trim().length < 100) {
                throw new Error("Could not extract enough text from the new PDF.");
            }
            
            setProgressMessage('Generating new levels with Gemini...');
            const existingLevelTitles = course.levels.map(l => l.levelTitle);
            // Defaulting to 'Beginner' for added content for simplicity.
            const newPartialLevels = await generateAdditionalLevels(course.courseTitle, existingLevelTitles, text, images, 'Beginner');
            
            const newLevels: Level[] = newPartialLevels.map((level, index) => ({
                ...level,
                levelId: `lvl-${Date.now()}-${course.levels.length + index}`,
                status: 'not-started',
            }));

            const updatedCourse = { ...course, levels: [...course.levels, ...newLevels] };
            
            // Recalculate progress
            const completedCount = updatedCourse.levels.filter(l => l.status === 'completed').length;
            updatedCourse.progress = Math.round((completedCount / updatedCourse.levels.length) * 100);

            handleUpdateCourse(updatedCourse);

        } catch (e: any) {
            setError(e.message || "Failed to add content to the course.");
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    }, []);

    const activeCourse = courses.find(c => c.courseId === activeCourseId);

    const renderMainContent = () => {
        if (activeCourse) {
            return (
                <CourseDisplay
                    key={activeCourse.courseId}
                    course={activeCourse}
                    setCourse={handleUpdateCourse}
                    onBackToDashboard={() => setActiveCourseId(null)}
                    onAddPdf={handleAddPdfToCourse}
                    isAddingContent={isLoading}
                    addContentError={error}
                    addContentProgressMessage={progressMessage}
                    clearAddContentError={() => setError(null)}
                />
            );
        }

        if (activeView === 'intro') {
            return <IntroPage onGetStarted={() => setActiveView('courses')} />;
        }

        return (
            <Dashboard
                courses={courses}
                onCreateCourse={handleCreateCourse}
                onSelectCourse={setActiveCourseId}
                onDeleteCourse={handleDeleteCourse}
                activeView={activeView === 'explorer' ? 'explorer' : 'courses'}
                setActiveView={(v) => setActiveView(v as any)}
            />
        );
    };

    return (
        <div className="min-h-screen bg-background dark:bg-text-dark text-text-dark dark:text-background font-sans transition-colors duration-300">
            <header className="bg-white dark:bg-[#4A2554] shadow-sm sticky top-0 z-30">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center cursor-pointer" onClick={() => { setActiveCourseId(null); setActiveView(courses.length > 0 ? 'courses' : 'intro'); }}>
                        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center mr-3 shadow-sm">
                            <Icon name="academic-cap" className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-text-dark dark:text-background">AI Course Creator</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                         <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="hidden sm:block text-xs font-medium text-gray-400 dark:text-primary-light hover:text-text-dark dark:hover:text-background transition-colors">
                            Powered by Gemini
                        </a>
                        <button onClick={toggleTheme} className="p-2 rounded-xl text-text-dark dark:text-background hover:bg-gray-100 dark:hover:bg-text-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Toggle theme">
                            {theme === 'light' ? <Icon name="moon" className="w-5 h-5" /> : <Icon name="sun" className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>
            
            <main className={`container mx-auto p-4 md:p-8 ${activeView === 'intro' && !activeCourse ? '' : 'max-w-5xl'}`}>
                {renderMainContent()}
            </main>

            {activeView !== 'intro' && !activeCourse && (
                <footer className="py-8 text-center border-t dark:border-primary">
                    <p className="text-sm text-gray-500 dark:text-primary-light">
                        AI Course Creator &bull; Build knowledge with Gemini
                    </p>
                </footer>
            )}
        </div>
    );
};

export default App;
