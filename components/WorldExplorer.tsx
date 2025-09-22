import React, { useState, useCallback, useEffect, memo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { QuizQuestion, generateWorldQuiz } from '../services/geminiService';
import { Icon } from './Icon';
import { Loader } from './Loader';
import QuizDisplay from './QuizDisplay';

// URL for the world map TopoJSON data
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const MAP_QUIZ_STORAGE_KEY = 'worldExplorerMapQuizState';

// Fisher-Yates shuffle algorithm
const shuffleArray = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

// Memoized Geography component to prevent unnecessary re-renders on hover
const MemoizedGeography = memo(Geography);


const WorldExplorer: React.FC = () => {
    const [selectedCountry, setSelectedCountry] = useState<string>('United States');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New state for map quiz
    const [quizMode, setQuizMode] = useState<'list' | 'trivia' | 'map'>('list');
    const [geoData, setGeoData] = useState<any>(null);
    const [mapQuizState, setMapQuizState] = useState({
        questions: [] as string[],
        currentIndex: 0,
        score: 0,
        selectedGeo: null as any,
        isCorrect: null as boolean | null,
        gameOver: false,
    });
    const [savedMapQuiz, setSavedMapQuiz] = useState<any>(null);
    const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
    const [position, setPosition] = useState({ coordinates: [0, 0] as [number, number], zoom: 1 });

    useEffect(() => {
        // Load saved quiz on mount
        try {
            const savedStateJSON = localStorage.getItem(MAP_QUIZ_STORAGE_KEY);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                if (savedState.questions && savedState.questions.length > 0) {
                    setSavedMapQuiz(savedState);
                }
            }
        } catch (e) {
            console.error("Failed to load map quiz state:", e);
            localStorage.removeItem(MAP_QUIZ_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        // Fetch geo data once on component mount
        fetch(GEO_URL)
            .then(res => res.json())
            .then(data => setGeoData(data))
            .catch(err => {
                console.error("Failed to load map data:", err);
                setError("Could not load map data. Please try again later.");
            });
    }, []);
    
    useEffect(() => {
        // Save quiz progress automatically
        if (quizMode === 'map' && !mapQuizState.gameOver && mapQuizState.questions.length > 0) {
            try {
                const stateToSave = {
                    questions: mapQuizState.questions,
                    currentIndex: mapQuizState.currentIndex,
                    score: mapQuizState.score,
                };
                localStorage.setItem(MAP_QUIZ_STORAGE_KEY, JSON.stringify(stateToSave));
                setSavedMapQuiz(stateToSave); // Keep UI in sync
            } catch (e) {
                console.error("Failed to save map quiz state:", e);
            }
        }
    }, [mapQuizState, quizMode]);

    useEffect(() => {
        if (quizMode === 'map') {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [quizMode]);

    const countries = [
        'United States', 'Japan', 'Brazil', 'Egypt', 'Italy', 'India', 'Australia', 'Nigeria', 'Mexico', 'China'
    ];

    const categories = [
        { name: 'Geography', icon: 'globe' as const, description: 'States, cities, and landmarks.' },
        { name: 'Culture', icon: 'academic-cap' as const, description: 'Food, festivals, and traditions.' },
        { name: 'Nature', icon: 'leaf' as const, description: 'Unique animals and plants.' },
        { name: 'History', icon: 'history' as const, description: 'Key historical events and figures.' },
        { name: 'Map Quiz', icon: 'map' as const, description: 'Guess the country on the map.' },
    ];

    const handleTriviaCategoryClick = useCallback(async (categoryName: string) => {
        setActiveCategory(categoryName);
        setIsLoading(true);
        setError(null);
        setQuiz(null);
        try {
            const newQuiz = await generateWorldQuiz(selectedCountry, categoryName);
            setQuiz(newQuiz);
            setQuizMode('trivia');
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedCountry]);
    
    const clearSavedQuiz = () => {
        localStorage.removeItem(MAP_QUIZ_STORAGE_KEY);
        setSavedMapQuiz(null);
    };

    const startNewMapQuiz = useCallback(() => {
        if (!geoData) return;
        
        clearSavedQuiz();
        const allCountries = geoData.objects.countries.geometries.map((g: any) => g.properties.name);
        const shuffled = shuffleArray(allCountries.filter(Boolean));
        
        const questions = shuffled.slice(0, 5);

        setMapQuizState({
            questions,
            currentIndex: 0,
            score: 0,
            selectedGeo: null,
            isCorrect: null,
            gameOver: false,
        });
        setQuizMode('map');
        setPosition({ coordinates: [0, 0], zoom: 1 });
    }, [geoData]);

    const resumeMapQuiz = () => {
        if (!savedMapQuiz) return;
        setMapQuizState({
            ...savedMapQuiz,
            selectedGeo: null,
            isCorrect: null,
            gameOver: false,
        });
        setQuizMode('map');
        setPosition({ coordinates: [0, 0], zoom: 1 });
    };

    const handleCategoryClick = (categoryName: string) => {
        if (categoryName === 'Map Quiz') {
            startNewMapQuiz();
        } else {
            handleTriviaCategoryClick(categoryName);
        }
    };
    
    const handleMapClick = (geo: any) => {
        if (mapQuizState.isCorrect !== null) return;
        const correctCountry = mapQuizState.questions[mapQuizState.currentIndex];
        const clickedCountry = geo.properties.name;
        const isCorrect = clickedCountry === correctCountry;

        setMapQuizState(prev => ({
            ...prev,
            selectedGeo: geo,
            isCorrect,
            score: isCorrect ? prev.score + 1 : prev.score,
        }));
    };

    const handleNextQuestion = () => {
        if (mapQuizState.currentIndex + 1 >= mapQuizState.questions.length) {
            setMapQuizState(prev => ({ ...prev, gameOver: true }));
        } else {
            setMapQuizState(prev => ({
                ...prev,
                currentIndex: prev.currentIndex + 1,
                selectedGeo: null,
                isCorrect: null,
            }));
        }
    };

    const handleResetAndExit = () => {
        setQuiz(null);
        setActiveCategory(null);
        setError(null);
        setIsLoading(false);
        setQuizMode('list');
        setMapQuizState({
            questions: [],
            currentIndex: 0,
            score: 0,
            selectedGeo: null,
            isCorrect: null,
            gameOver: false,
        });
        clearSavedQuiz();
    };

    const handleExitMapQuizView = () => {
        setQuizMode('list');
    };

    const handleZoomIn = () => {
        if (position.zoom >= 8) return;
        setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }));
    };

    const handleZoomOut = () => {
        if (position.zoom <= 1) return;
        setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }));
    };

    const handleResetZoom = () => {
        setPosition({ coordinates: [0, 0], zoom: 1 });
    };

    const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number; }) => {
        setPosition(position);
    };
    
    const getGeographyStyle = (geo: any) => {
        const isHovered = hoveredGeo === geo.properties.name;
        const isSelected = mapQuizState.selectedGeo?.properties.name === geo.properties.name;
        const correctCountry = mapQuizState.questions[mapQuizState.currentIndex];
        const isCorrectAnswer = geo.properties.name === correctCountry;

        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const defaultFill = theme === 'dark' ? '#6b7280' : '#F2CFC2';
        const defaultStroke = theme === 'dark' ? '#374151' : '#FFFFFF';

        if (mapQuizState.isCorrect !== null) {
            if (isCorrectAnswer) return { fill: '#4ade80', stroke: '#15803d' };
            if (isSelected && !mapQuizState.isCorrect) return { fill: '#f87171', stroke: '#b91c1c' };
        } else {
             if (isHovered) return { fill: '#F2B872', stroke: '#F27B50' };
        }
        
        return { fill: defaultFill, stroke: defaultStroke };
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-md text-center">
                <Loader />
                <p className="mt-4 text-lg text-gray-600 dark:text-primary-light">
                    {quizMode === 'map' ? 'Preparing map quiz...' : `Generating your ${activeCategory} quiz for ${selectedCountry}...`}
                </p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-md">
                <p><span className="font-bold">Error:</span> {error}</p>
                <button onClick={handleResetAndExit} className="mt-2 text-sm font-semibold text-red-800 hover:underline">
                    Try Again
                </button>
            </div>
        );
    }

    if (quizMode === 'trivia' && quiz) {
        return (
             <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md">
                 <h2 className="text-xl font-bold text-text-dark dark:text-background mb-4">{activeCategory} Quiz: {selectedCountry}</h2>
                <QuizDisplay quiz={quiz} onBack={handleResetAndExit} />
             </div>
        );
    }
    
    if (quizMode === 'map' && !mapQuizState.gameOver) {
        const currentQuestion = mapQuizState.questions[mapQuizState.currentIndex];
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={handleExitMapQuizView}>
                <div className="bg-white dark:bg-[#4A2554] rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col p-4 sm:p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex-shrink-0">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-bold text-text-dark dark:text-background">Map Quiz</h2>
                            <p className="font-semibold text-text-dark dark:text-background">Score: {mapQuizState.score} / {mapQuizState.questions.length}</p>
                        </div>
                        <p className="text-lg text-center mb-4 text-text-dark dark:text-background">Find: <span className="font-bold text-accent">{currentQuestion}</span></p>
                    </div>
                    
                    <div className="flex-grow border dark:border-primary rounded-lg overflow-hidden relative bg-primary-light dark:bg-text-dark min-h-0">
                        <ComposableMap style={{ width: '100%', height: '100%' }}>
                            <ZoomableGroup
                                zoom={position.zoom}
                                center={position.coordinates}
                                onMoveEnd={handleMoveEnd}
                            >
                                <Geographies geography={GEO_URL}>
                                    {({ geographies }) =>
                                        geographies.map(geo => (
                                            <MemoizedGeography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                onClick={() => handleMapClick(geo)}
                                                onMouseEnter={() => setHoveredGeo(geo.properties.name)}
                                                onMouseLeave={() => setHoveredGeo(null)}
                                                style={{
                                                    default: getGeographyStyle(geo),
                                                    hover: getGeographyStyle(geo),
                                                    pressed: { ...getGeographyStyle(geo), outline: 'none' },
                                                }}
                                                className="cursor-pointer outline-none"
                                            />
                                        ))
                                    }
                                </Geographies>
                            </ZoomableGroup>
                        </ComposableMap>
                        <div className="absolute right-2 bottom-2 flex flex-col space-y-1">
                            <button onClick={handleZoomIn} aria-label="Zoom in" className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#4A2554] border border-gray-300 dark:border-primary rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-[#5A3564] focus:outline-none focus:ring-2 focus:ring-accent">
                                <span className="text-xl font-thin select-none text-text-dark dark:text-background">+</span>
                            </button>
                            <button onClick={handleZoomOut} aria-label="Zoom out" className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#4A2554] border border-gray-300 dark:border-primary rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-[#5A3564] focus:outline-none focus:ring-2 focus:ring-accent">
                                <span className="text-2xl font-thin select-none text-text-dark dark:text-background">-</span>
                            </button>
                            <button onClick={handleResetZoom} aria-label="Reset view" className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#4A2554] border border-gray-300 dark:border-primary rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-[#5A3564] focus:outline-none focus:ring-2 focus:ring-accent">
                                <Icon name="refresh" className="w-5 h-5 text-gray-600 dark:text-primary-light" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-shrink-0">
                        <div className="h-12 flex items-center justify-center text-center">
                            {mapQuizState.isCorrect === true && <p className="text-green-600 dark:text-green-400 font-bold">Correct!</p>}
                            {mapQuizState.isCorrect === false && <p className="text-red-600 dark:text-red-400 font-bold">Incorrect! That was {mapQuizState.selectedGeo?.properties.name}.</p>}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <button onClick={handleExitMapQuizView} className="text-sm text-gray-500 dark:text-primary-light hover:text-text-dark dark:hover:text-background">Exit Quiz</button>
                            {mapQuizState.isCorrect !== null && (
                                <button onClick={handleNextQuestion} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90">
                                   {mapQuizState.currentIndex + 1 === mapQuizState.questions.length ? 'Finish Quiz' : 'Next Question'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (quizMode === 'map' && mapQuizState.gameOver) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-[#4A2554] p-8 rounded-lg shadow-xl text-center w-full max-w-md">
                    <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-4">Quiz Complete!</h2>
                    <p className="text-4xl font-bold mb-6 text-text-dark dark:text-background">You scored {mapQuizState.score} out of {mapQuizState.questions.length}</p>
                     <div className="flex justify-center space-x-4">
                         <button onClick={handleResetAndExit} className="bg-gray-200 dark:bg-text-dark text-text-dark dark:text-background font-bold py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-[#5A3564]">
                            Back to Menu
                        </button>
                        <button onClick={startNewMapQuiz} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90">
                            Play Again
                        </button>
                     </div>
                </div>
            </div>
        );
    }

    // Default view: list of categories
    return (
        <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-2">World Explorer Trivia</h2>
            <p className="text-gray-600 dark:text-primary-light mb-6">Select a country and a category to test your knowledge!</p>

            <div className="mb-6 max-w-sm">
                <label htmlFor="country-select" className="block text-sm font-medium text-gray-700 dark:text-primary-light mb-1">Country</label>
                <select
                    id="country-select"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full p-2 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md focus:ring-accent focus:border-accent text-text-dark dark:text-background"
                    disabled={!geoData}
                >
                    {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.slice(0, 4).map(category => (
                    <button
                        key={category.name}
                        onClick={() => handleCategoryClick(category.name)}
                        className="p-4 bg-gray-50 dark:bg-text-dark border border-gray-200 dark:border-primary rounded-lg text-left hover:bg-primary-light dark:hover:bg-[#5A3564] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                    >
                        <div className="flex items-center">
                            <Icon name={category.icon} className="w-8 h-8 text-accent" />
                            <div className="ml-4">
                                <p className="text-lg font-semibold text-text-dark dark:text-background">{category.name}</p>
                                <p className="text-sm text-gray-500 dark:text-primary-light">{category.description}</p>
                            </div>
                        </div>
                    </button>
                ))}
                
                {savedMapQuiz ? (
                    <div className="p-4 bg-gray-50 dark:bg-text-dark border border-gray-200 dark:border-primary rounded-lg text-left focus:outline-none transition-colors md:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center mb-3 sm:mb-0">
                                <Icon name="map" className="w-8 h-8 text-accent" />
                                <div className="ml-4">
                                    <p className="text-lg font-semibold text-text-dark dark:text-background">Map Quiz In Progress</p>
                                    <p className="text-sm text-gray-500 dark:text-primary-light">
                                        Continue where you left off ({savedMapQuiz.currentIndex}/{savedMapQuiz.questions.length} - Score: {savedMapQuiz.score})
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end space-x-3 shrink-0">
                                <button onClick={startNewMapQuiz} className="font-semibold text-sm text-text-dark dark:text-background hover:opacity-80 px-3 py-1">
                                    Start New
                                </button>
                                <button onClick={resumeMapQuiz} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90 text-sm">
                                    Resume Quiz
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        key={categories[4].name}
                        onClick={() => handleCategoryClick(categories[4].name)}
                        disabled={!geoData}
                        className="p-4 bg-gray-50 dark:bg-text-dark border border-gray-200 dark:border-primary rounded-lg text-left hover:bg-primary-light dark:hover:bg-[#5A3564] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-center">
                            <Icon name={categories[4].icon} className="w-8 h-8 text-accent" />
                            <div className="ml-4">
                                <p className="text-lg font-semibold text-text-dark dark:text-background">{categories[4].name}</p>
                                <p className="text-sm text-gray-500 dark:text-primary-light">{categories[4].description}</p>
                            </div>
                        </div>
                    </button>
                )}
            </div>
             {!geoData && (
                <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-primary-light">
                    <Loader /> <span className="ml-2">Loading map data...</span>
                </div>
            )}
        </div>
    );
};

export default WorldExplorer;