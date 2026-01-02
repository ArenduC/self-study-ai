
import React, { useState, useCallback, useEffect, memo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { QuizQuestion, generateWorldQuiz } from '../services/geminiService';
import { Icon } from './Icon';
import { Loader } from './Loader';
import QuizDisplay from './QuizDisplay';

// Map configuration
const MAP_CONFIGS = {
    world: {
        url: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
        objectKey: 'countries',
        nameProperty: 'name',
        label: 'World Countries'
    },
    india: {
        url: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json',
        objectKey: 'india',
        nameProperty: 'ST_NM',
        label: 'India States'
    },
    usa: {
        url: 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
        objectKey: 'states',
        nameProperty: 'name',
        label: 'USA States'
    }
};

type MapType = keyof typeof MAP_CONFIGS;

const MAP_QUIZ_STORAGE_KEY = 'worldExplorerMapQuizStateV2';

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

    // Map quiz state
    const [quizMode, setQuizMode] = useState<'list' | 'trivia' | 'map'>('list');
    const [currentMapType, setCurrentMapType] = useState<MapType>('world');
    const [geoData, setGeoData] = useState<any>(null);
    const [mapQuizState, setMapQuizState] = useState({
        questions: [] as string[],
        currentIndex: 0,
        score: 0,
        selectedGeo: null as any,
        isCorrect: null as boolean | null,
        gameOver: false,
        mapType: 'world' as MapType
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

    // Fetch geo data whenever map type changes for a quiz
    const fetchGeoData = async (type: MapType) => {
        setIsLoading(true);
        try {
            const res = await fetch(MAP_CONFIGS[type].url);
            const data = await res.json();
            setGeoData(data);
            setCurrentMapType(type);
        } catch (err) {
            console.error("Failed to load map data:", err);
            setError(`Could not load ${MAP_CONFIGS[type].label} data. Please try again later.`);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        // Save quiz progress automatically
        if (quizMode === 'map' && !mapQuizState.gameOver && mapQuizState.questions.length > 0) {
            try {
                const stateToSave = {
                    questions: mapQuizState.questions,
                    currentIndex: mapQuizState.currentIndex,
                    score: mapQuizState.score,
                    mapType: mapQuizState.mapType
                };
                localStorage.setItem(MAP_QUIZ_STORAGE_KEY, JSON.stringify(stateToSave));
                setSavedMapQuiz(stateToSave);
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
        'United States', 'India', 'Japan', 'Brazil', 'Egypt', 'Italy', 'Australia', 'Nigeria', 'Mexico', 'China'
    ];

    const categories = [
        { name: 'Geography', icon: 'globe' as const, description: 'States, cities, and landmarks.' },
        { name: 'Culture', icon: 'academic-cap' as const, description: 'Food, festivals, and traditions.' },
        { name: 'Nature', icon: 'leaf' as const, description: 'Unique animals and plants.' },
        { name: 'History', icon: 'history' as const, description: 'Key historical events and figures.' },
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

    const startNewMapQuiz = async (type: MapType) => {
        setError(null);
        await fetchGeoData(type);
        
        // Use the just-fetched or cached geoData
        // We fetch explicitly to ensure we have it before calculating questions
        const res = await fetch(MAP_CONFIGS[type].url);
        const data = await res.json();
        
        const config = MAP_CONFIGS[type];
        const geometries = data.objects[config.objectKey].geometries;
        const allNames = geometries.map((g: any) => g.properties[config.nameProperty]);
        const validNames = allNames.filter((n: any) => n && n !== "null");
        
        const shuffled = shuffleArray(validNames);
        const questions = shuffled.slice(0, 5);

        setMapQuizState({
            questions,
            currentIndex: 0,
            score: 0,
            selectedGeo: null,
            isCorrect: null,
            gameOver: false,
            mapType: type
        });
        setQuizMode('map');
        setPosition({ coordinates: type === 'world' ? [0, 0] : type === 'india' ? [78, 22] : [-96, 37], zoom: type === 'world' ? 1 : 2 });
    };

    const resumeMapQuiz = async () => {
        if (!savedMapQuiz) return;
        await fetchGeoData(savedMapQuiz.mapType);
        setMapQuizState({
            ...savedMapQuiz,
            selectedGeo: null,
            isCorrect: null,
            gameOver: false,
        });
        setQuizMode('map');
        const type = savedMapQuiz.mapType;
        setPosition({ coordinates: type === 'world' ? [0, 0] : type === 'india' ? [78, 22] : [-96, 37], zoom: type === 'world' ? 1 : 2 });
    };

    const handleMapClick = (geo: any) => {
        if (mapQuizState.isCorrect !== null) return;
        const config = MAP_CONFIGS[mapQuizState.mapType];
        const correctName = mapQuizState.questions[mapQuizState.currentIndex];
        const clickedName = geo.properties[config.nameProperty];
        const isCorrect = clickedName === correctName;

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
            mapType: 'world'
        });
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
        const type = mapQuizState.mapType;
        setPosition({ coordinates: type === 'world' ? [0, 0] : type === 'india' ? [78, 22] : [-96, 37], zoom: type === 'world' ? 1 : 2 });
    };

    const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number; }) => {
        setPosition(position);
    };
    
    const getGeographyStyle = (geo: any) => {
        const config = MAP_CONFIGS[mapQuizState.mapType];
        const geoName = geo.properties[config.nameProperty];
        const isHovered = hoveredGeo === geoName;
        const isSelected = mapQuizState.selectedGeo?.properties[config.nameProperty] === geoName;
        const correctName = mapQuizState.questions[mapQuizState.currentIndex];
        const isCorrectAnswer = geoName === correctName;

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
                <div className="mt-4 flex space-x-4">
                    <button onClick={handleResetAndExit} className="text-sm font-semibold text-red-800 hover:underline">
                        Back to Menu
                    </button>
                </div>
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
        const config = MAP_CONFIGS[mapQuizState.mapType];
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setQuizMode('list')}>
                <div className="bg-white dark:bg-[#4A2554] rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col p-4 sm:p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex-shrink-0">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-bold text-text-dark dark:text-background">{config.label} Quiz</h2>
                            <p className="font-semibold text-text-dark dark:text-background">Score: {mapQuizState.score} / {mapQuizState.questions.length}</p>
                        </div>
                        <p className="text-lg text-center mb-4 text-text-dark dark:text-background">Find: <span className="font-bold text-accent">{currentQuestion}</span></p>
                    </div>
                    
                    <div className="flex-grow border dark:border-primary rounded-lg overflow-hidden relative bg-primary-light dark:bg-text-dark min-h-0">
                        <ComposableMap style={{ width: '100%', height: '100%' }} projectionConfig={{ scale: mapQuizState.mapType === 'world' ? 160 : 600 }}>
                            <ZoomableGroup
                                zoom={position.zoom}
                                center={position.coordinates}
                                onMoveEnd={handleMoveEnd}
                            >
                                <Geographies geography={geoData}>
                                    {({ geographies }) =>
                                        geographies.map(geo => (
                                            <MemoizedGeography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                onClick={() => handleMapClick(geo)}
                                                onMouseEnter={() => setHoveredGeo(geo.properties[config.nameProperty])}
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
                            {mapQuizState.isCorrect === false && <p className="text-red-600 dark:text-red-400 font-bold">Incorrect! That was {mapQuizState.selectedGeo?.properties[config.nameProperty]}.</p>}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <button onClick={() => setQuizMode('list')} className="text-sm text-gray-500 dark:text-primary-light hover:text-text-dark dark:hover:text-background">Exit Quiz</button>
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
                        <button onClick={() => startNewMapQuiz(mapQuizState.mapType)} className="bg-accent text-white font-bold py-2 px-4 rounded-md hover:opacity-90">
                            Play Again
                        </button>
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-2">World Explorer Trivia</h2>
            <p className="text-gray-600 dark:text-primary-light mb-6">Select a country and a category to test your knowledge!</p>

            <div className="mb-8 p-4 bg-primary-light dark:bg-text-dark rounded-xl border border-primary dark:border-accent shadow-sm">
                <h3 className="text-lg font-bold text-text-dark dark:text-background mb-4 flex items-center">
                    <Icon name="map" className="w-6 h-6 mr-2 text-accent" />
                    Interactive Map Quizzes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button 
                        onClick={() => startNewMapQuiz('world')}
                        className="p-3 bg-white dark:bg-[#4A2554] border border-gray-200 dark:border-primary rounded-lg hover:border-accent transition-all flex flex-col items-center text-center group"
                    >
                        <Icon name="globe" className="w-8 h-8 mb-2 text-accent group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-sm text-text-dark dark:text-background">World Map</span>
                        <span className="text-xs text-gray-500 dark:text-primary-light">Guess countries</span>
                    </button>
                    <button 
                        onClick={() => startNewMapQuiz('india')}
                        className="p-3 bg-white dark:bg-[#4A2554] border border-gray-200 dark:border-primary rounded-lg hover:border-accent transition-all flex flex-col items-center text-center group"
                    >
                        <div className="w-8 h-8 mb-2 flex items-center justify-center font-bold text-accent border-2 border-accent rounded-full group-hover:scale-110 transition-transform">IN</div>
                        <span className="font-bold text-sm text-text-dark dark:text-background">India States</span>
                        <span className="text-xs text-gray-500 dark:text-primary-light">Guess states/UTs</span>
                    </button>
                    <button 
                        onClick={() => startNewMapQuiz('usa')}
                        className="p-3 bg-white dark:bg-[#4A2554] border border-gray-200 dark:border-primary rounded-lg hover:border-accent transition-all flex flex-col items-center text-center group"
                    >
                        <div className="w-8 h-8 mb-2 flex items-center justify-center font-bold text-accent border-2 border-accent rounded-full group-hover:scale-110 transition-transform">US</div>
                        <span className="font-bold text-sm text-text-dark dark:text-background">USA States</span>
                        <span className="text-xs text-gray-500 dark:text-primary-light">Guess 50 states</span>
                    </button>
                </div>
                {savedMapQuiz && (
                    <div className="mt-4 pt-4 border-t border-primary dark:border-accent flex justify-between items-center">
                        <div className="text-sm">
                            <span className="font-semibold text-text-dark dark:text-background">Progress: </span>
                            <span className="text-gray-600 dark:text-primary-light">
                                {MAP_CONFIGS[savedMapQuiz.mapType as MapType].label} ({savedMapQuiz.currentIndex}/{savedMapQuiz.questions.length})
                            </span>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={clearSavedQuiz} className="text-xs font-medium text-gray-500 hover:text-red-500 transition-colors">Clear Saved</button>
                            <button onClick={resumeMapQuiz} className="bg-accent text-white px-4 py-1.5 rounded-md text-sm font-bold hover:opacity-90">Resume</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mb-6 max-w-sm">
                <label htmlFor="country-select" className="block text-sm font-medium text-gray-700 dark:text-primary-light mb-1">Trivia Country Focus</label>
                <select
                    id="country-select"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full p-2 border border-primary-light dark:border-primary bg-white dark:bg-text-dark rounded-md focus:ring-accent focus:border-accent text-text-dark dark:text-background"
                >
                    {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(category => (
                    <button
                        key={category.name}
                        // Fixed: Corrected handler name from handleCategoryClick to handleTriviaCategoryClick.
                        onClick={() => handleTriviaCategoryClick(category.name)}
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
            </div>
        </div>
    );
};

export default WorldExplorer;
