import { Course } from './geminiService';

const STORAGE_KEY = 'ai-courses';

/**
 * Loads courses from localStorage.
 * @returns An array of courses, or an empty array if none are found or an error occurs.
 */
export const loadCourses = (): Course[] => {
    try {
        const savedCourses = localStorage.getItem(STORAGE_KEY);
        if (savedCourses) {
            // A simple validation to ensure we're parsing an array.
            const parsed = JSON.parse(savedCourses);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("Failed to load or parse courses from localStorage", e);
    }
    return [];
};

/**
 * Saves courses to localStorage.
 * @param courses The array of courses to save.
 */
export const saveCourses = (courses: Course[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch (e) {
        console.error("Failed to save courses to localStorage", e);
    }
};
