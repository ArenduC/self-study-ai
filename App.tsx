import React, { useState, useEffect, useCallback } from 'react';
import { Course, Level } from './services/geminiService';
import { extractPdfContent } from './services/pdfService';
import { generateAdditionalLevels } from './services/geminiService';
import Dashboard from './components/Dashboard';
import CourseDisplay from './components/CourseDisplay';
import { loadCourses, saveCourses } from './services/courseStore';
import { Icon } from './components/Icon';

const App: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>(() => loadCourses());
    const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [activeView, setActiveView] = useState<'courses' | 'explorer'>('courses');
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
    };

    const handleUpdateCourse = (updatedCourse: Course) => {
        setCourses(prevCourses =>
            prevCourses.map(c => c.courseId === updatedCourse.courseId ? updatedCourse : c)
        );
    };

    const handleDeleteCourse = (courseId: string) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            setCourses(prevCourses => prevCourses.filter(c => c.courseId !== courseId));
            if (activeCourseId === courseId) {
                setActiveCourseId(null);
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

    return (
        <div className="min-h-screen bg-background dark:bg-text-dark text-text-dark dark:text-background font-sans">
            <header className="bg-white dark:bg-[#4A2554] shadow-sm">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-text-dark dark:text-background">AI Course Creator</h1>
                    <div className="flex items-center space-x-4">
                         <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-primary-light hover:text-text-dark dark:hover:text-background">
                            Powered by Gemini
                        </a>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-text-dark dark:text-background hover:bg-gray-100 dark:hover:bg-text-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent" aria-label="Toggle theme">
                            {theme === 'light' ? <Icon name="moon" className="w-5 h-5" /> : <Icon name="sun" className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    {activeCourse ? (
                        <CourseDisplay
                            key={activeCourse.courseId} // Ensure re-mount on course change
                            course={activeCourse}
                            setCourse={handleUpdateCourse}
                            onBackToDashboard={() => setActiveCourseId(null)}
                            onAddPdf={handleAddPdfToCourse}
                            isAddingContent={isLoading}
                            addContentError={error}
                            addContentProgressMessage={progressMessage}
                            clearAddContentError={() => setError(null)}
                        />
                    ) : (
                        <Dashboard
                            courses={courses}
                            onCreateCourse={handleCreateCourse}
                            onSelectCourse={setActiveCourseId}
                            onDeleteCourse={handleDeleteCourse}
                            activeView={activeView}
                            setActiveView={setActiveView}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;