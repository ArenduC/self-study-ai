
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
    }
};

type MapType = keyof typeof MAP_CONFIGS;
type Difficulty = 'Easy' | 'Medium' | 'Hard';

const TRIVIA_HISTORY_KEY = 'worldExplorerTriviaHistory';
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

const MemoizedGeography = memo(Geography);

const WorldExplorer: React.FC = () => {
    const [selectedCountry, setSelectedCountry] = useState<string>('India');
    const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Map quiz state
    const [quizMode, setQuizMode] = useState<'list' | 'trivia' | 'map'>('list');
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
        }
    }, []);

    const fetchGeoData = async (type: MapType) => {
        setIsLoading(true);
        try {
            const res = await fetch(MAP_CONFIGS[type].url);
            const data = await res.json();
            setGeoData(data);
            return data;
        } catch (err) {
            console.error("Failed to load map data:", err);
            setError(`Could not load ${MAP_CONFIGS[type].label} data.`);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const handleTriviaCategoryClick = useCallback(async (categoryName: string) => {
        setActiveCategory(categoryName);
        setIsLoading(true);
        setError(null);
        setQuiz(null);

        // Load history to avoid repeats
        const historyStr = localStorage.getItem(TRIVIA_HISTORY_KEY) || '[]';
        const history = JSON.parse(historyStr);
        const previousQuestions = history.map((h: any) => h.question);

        try {
            const promptSuffix = previousQuestions.length > 0 
                ? `. Do NOT repeat these questions: ${previousQuestions.slice(-10).join(', ')}` 
                : "";
            
            const difficultyInstruction = `This quiz should be at a ${difficulty} level of difficulty.`;
            
            const newQuiz = await generateWorldQuiz(selectedCountry, `${categoryName}. ${difficultyInstruction}${promptSuffix}`);
            setQuiz(newQuiz);
            setQuizMode('trivia');
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedCountry, difficulty]);

    const onTriviaComplete = (score: number) => {
        if (!quiz) return;
        // Save to history
        const historyStr = localStorage.getItem(TRIVIA_HISTORY_KEY) || '[]';
        const history = JSON.parse(historyStr);
        const newEntries = quiz.map(q => ({
            ...q,
            country: selectedCountry,
            category: activeCategory,
            difficulty,
            timestamp: Date.now(),
            score: score
        }));
        localStorage.setItem(TRIVIA_HISTORY_KEY, JSON.stringify([...history, ...newEntries].slice(-100)));
    };

    const startNewMapQuiz = async (type: MapType) => {
        setError(null);
        const data = await fetchGeoData(type);
        if (!data) return;
        
        const config = MAP_CONFIGS[type];
        const geometries = data.objects[config.objectKey].geometries;
        const allNames = geometries.map((g: any) => g.properties[config.nameProperty]).filter(Boolean);
        
        const shuffled = shuffleArray([...allNames]);
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
        setPosition({ 
            coordinates: type === 'world' ? [0, 0] : type === 'india' ? [78, 22] : [0, 0], 
            zoom: type === 'world' ? 1 : 2 
        });
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
            const finalScore = mapQuizState.isCorrect ? mapQuizState.score : mapQuizState.score;
            // Store map result
            const mapHistory = JSON.parse(localStorage.getItem('mapQuizHistory') || '[]');
            mapHistory.push({
                type: mapQuizState.mapType,
                score: finalScore,
                total: mapQuizState.questions.length,
                timestamp: Date.now()
            });
            localStorage.setItem('mapQuizHistory', JSON.stringify(mapHistory.slice(-50)));
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
        setQuizMode('list');
    };

    const getGeographyStyle = (geo: any) => {
        const config = MAP_CONFIGS[mapQuizState.mapType];
        const geoName = geo.properties[config.nameProperty];
        const isHovered = hoveredGeo === geoName;
        const isSelected = mapQuizState.selectedGeo?.properties[config.nameProperty] === geoName;
        const correctName = mapQuizState.questions[mapQuizState.currentIndex];
        const isCorrectAnswer = geoName === correctName;

        const isDark = document.documentElement.classList.contains('dark');
        const defaultFill = isDark ? '#4b5563' : '#F2CFC2';
        const defaultStroke = isDark ? '#1f2937' : '#FFFFFF';

        if (mapQuizState.isCorrect !== null) {
            if (isCorrectAnswer) return { fill: '#4ade80', stroke: '#166534' };
            if (isSelected && !mapQuizState.isCorrect) return { fill: '#f87171', stroke: '#991b1b' };
        }
        if (isHovered) return { fill: '#F2B872', stroke: '#F27B50' };
        return { fill: defaultFill, stroke: defaultStroke };
    };

    const countries = ['India', 'United States', 'Japan', 'Brazil', 'Egypt', 'Italy', 'Australia', 'Nigeria', 'Mexico', 'France'];
    const categories = [
        { name: 'Geography', icon: 'globe' as const, description: 'States, cities, and landmarks.' },
        { name: 'Culture', icon: 'academic-cap' as const, description: 'Food, festivals, and traditions.' },
        { name: 'Nature', icon: 'leaf' as const, description: 'Unique animals and plants.' },
        { name: 'History', icon: 'history' as const, description: 'Key historical events and figures.' },
    ];

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-md text-center">
                <Loader />
                <p className="mt-4 text-lg text-gray-600 dark:text-primary-light">Preparing your quest...</p>
            </div>
        );
    }

    if (quizMode === 'trivia' && quiz) {
        return (
            <div className="bg-white dark:bg-[#4A2554] p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text-dark dark:text-background">{selectedCountry} - {activeCategory} ({difficulty})</h2>
                </div>
                <QuizDisplay quiz={quiz} onBack={handleResetAndExit} onQuizComplete={onTriviaComplete} />
            </div>
        );
    }

    if (quizMode === 'map') {
        if (mapQuizState.gameOver) {
            return (
                <div className="bg-white dark:bg-[#4A2554] p-12 rounded-lg shadow-xl text-center">
                    <Icon name="check" className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-4">Quiz Complete!</h2>
                    <p className="text-4xl font-bold mb-6 text-text-dark dark:text-background">Score: {mapQuizState.score} / {mapQuizState.questions.length}</p>
                    <button onClick={handleResetAndExit} className="bg-accent text-white font-bold py-3 px-8 rounded-xl hover:opacity-90">Return to Menu</button>
                </div>
            );
        }

        const config = MAP_CONFIGS[mapQuizState.mapType];
        return (
            <div className="bg-white dark:bg-[#4A2554] rounded-xl shadow-xl flex flex-col h-[80vh] overflow-hidden">
                <div className="p-4 bg-primary-light dark:bg-text-dark flex justify-between items-center border-b dark:border-primary">
                    <div>
                        <h2 className="font-bold text-text-dark dark:text-background">{config.label} Challenge</h2>
                        <p className="text-sm text-gray-600 dark:text-primary-light">Find: <span className="font-bold text-accent text-lg">{mapQuizState.questions[mapQuizState.currentIndex]}</span></p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-text-dark dark:text-background">Score: {mapQuizState.score}/{mapQuizState.questions.length}</p>
                        <button onClick={handleResetAndExit} className="text-xs text-red-500 hover:underline">Exit Quiz</button>
                    </div>
                </div>

                <div className="flex-grow relative bg-blue-50 dark:bg-slate-900 cursor-crosshair">
                    <ComposableMap style={{ width: '100%', height: '100%' }}>
                        <ZoomableGroup zoom={position.zoom} center={position.coordinates} onMoveEnd={pos => setPosition(pos)}>
                            <Geographies geography={geoData}>
                                {({ geographies }) => geographies.map(geo => (
                                    <MemoizedGeography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        onClick={() => handleMapClick(geo)}
                                        onMouseEnter={() => setHoveredGeo(geo.properties[config.nameProperty])}
                                        onMouseLeave={() => setHoveredGeo(null)}
                                        style={{
                                            default: getGeographyStyle(geo),
                                            hover: getGeographyStyle(geo),
                                            pressed: getGeographyStyle(geo),
                                        }}
                                        className="transition-colors duration-200 outline-none"
                                    />
                                ))}
                            </Geographies>
                        </ZoomableGroup>
                    </ComposableMap>
                </div>

                <div className="p-4 bg-white dark:bg-[#4A2554] border-t dark:border-primary flex justify-between items-center">
                    <div className="h-8">
                        {mapQuizState.isCorrect === true && <span className="text-green-600 font-bold animate-bounce block">✓ Correct!</span>}
                        {mapQuizState.isCorrect === false && <span className="text-red-600 font-bold block">✗ Wrong! That was {mapQuizState.selectedGeo?.properties[config.nameProperty]}</span>}
                    </div>
                    {mapQuizState.isCorrect !== null && (
                        <button onClick={handleNextQuestion} className="bg-accent text-white px-6 py-2 rounded-lg font-bold hover:opacity-90">
                            {mapQuizState.currentIndex === mapQuizState.questions.length - 1 ? 'See Results' : 'Next Question'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Map Section */}
            <div className="bg-white dark:bg-[#4A2554] p-6 rounded-2xl shadow-sm border dark:border-primary">
                <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-4 flex items-center">
                    <Icon name="map" className="w-6 h-6 mr-2 text-accent" />
                    Cartography Challenges
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={() => startNewMapQuiz('india')} className="p-6 border-2 border-primary-light dark:border-primary rounded-2xl hover:border-accent transition-all text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🇮🇳</div>
                        <p className="font-bold dark:text-background">India States</p>
                    </button>
                    <button onClick={() => startNewMapQuiz('world')} className="p-6 border-2 border-primary-light dark:border-primary rounded-2xl hover:border-accent transition-all text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🌍</div>
                        <p className="font-bold dark:text-background">World Countries</p>
                    </button>
                </div>
            </div>

            {/* Trivia Section */}
            <div className="bg-white dark:bg-[#4A2554] p-6 rounded-2xl shadow-sm border dark:border-primary">
                <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-6 flex items-center">
                    <Icon name="sparkles" className="w-6 h-6 mr-2 text-accent" />
                    Deep Trivia
                </h2>
                
                <div className="flex flex-col md:flex-row gap-6 mb-8">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-primary-light mb-2">Select Focus</label>
                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-text-dark border dark:border-primary rounded-xl dark:text-background focus:ring-accent focus:border-accent"
                        >
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-primary-light mb-2">Difficulty Scale</label>
                        <div className="flex bg-gray-100 dark:bg-text-dark p-1 rounded-xl border dark:border-primary">
                            {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(level => (
                                <button
                                    key={level}
                                    onClick={() => setDifficulty(level)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${difficulty === level ? 'bg-accent text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#4A2554]'}`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map(cat => (
                        <button
                            key={cat.name}
                            onClick={() => handleTriviaCategoryClick(cat.name)}
                            className="flex items-center p-4 border dark:border-primary rounded-xl hover:bg-primary-light dark:hover:bg-text-dark transition-colors group text-left"
                        >
                            <div className="w-12 h-12 bg-primary-light dark:bg-[#4A2554] rounded-xl flex items-center justify-center mr-4 group-hover:bg-accent group-hover:text-white transition-colors">
                                <Icon name={cat.icon} className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-bold dark:text-background">{cat.name}</p>
                                <p className="text-xs text-gray-500 dark:text-primary-light">{cat.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorldExplorer;
