
import React from 'react';
import { Icon } from './Icon';

interface IntroPageProps {
    onGetStarted: () => void;
}

const IntroPage: React.FC<IntroPageProps> = ({ onGetStarted }) => {
    return (
        <div className="relative overflow-hidden bg-background dark:bg-text-dark min-h-[calc(100vh-100px)] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-light dark:bg-accent opacity-20 dark:opacity-10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-accent dark:bg-primary opacity-20 dark:opacity-10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-[#4A2554] shadow-sm border border-primary-light dark:border-primary mb-8 animate-fade-in-down">
                    <Icon name="sparkles" className="w-5 h-5 text-accent mr-2" />
                    <span className="text-sm font-semibold text-text-dark dark:text-background">AI-Powered Learning Revolution</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-extrabold text-text-dark dark:text-background tracking-tight mb-6 animate-fade-in">
                    Master Any Topic <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">In Minutes, Not Days.</span>
                </h1>
                
                <p className="text-xl text-gray-600 dark:text-primary-light mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in delay-200">
                    Transform dense PDFs and documents into interactive, multi-level courses with summaries, quizzes, and curated resources. Powered by the latest Gemini AI models.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-16 animate-fade-in delay-300">
                    <button 
                        onClick={onGetStarted}
                        className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-accent rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                    >
                        Get Started for Free
                        <Icon name="arrow-right" className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>

                {/* Features Grid */}
                <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left animate-fade-in-up delay-500">
                    <div className="bg-white dark:bg-[#4A2554] p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-primary hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-primary-light dark:bg-text-dark rounded-xl flex items-center justify-center mb-6">
                            <Icon name="upload" className="w-6 h-6 text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text-dark dark:text-background mb-3">Instant Extraction</h3>
                        <p className="text-gray-600 dark:text-primary-light text-sm">Upload any academic PDF. Our AI extracts text and key visual aids to build your foundation.</p>
                    </div>

                    <div className="bg-white dark:bg-[#4A2554] p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-primary hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-primary-light dark:bg-text-dark rounded-xl flex items-center justify-center mb-6">
                            <Icon name="chart-bar" className="w-6 h-6 text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text-dark dark:text-background mb-3">Adaptive Levels</h3>
                        <p className="text-gray-600 dark:text-primary-light text-sm">Courses are broken into Beginner to Advanced modules, ensuring you master fundamentals before moving on.</p>
                    </div>

                    <div className="bg-white dark:bg-[#4A2554] p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-primary hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-primary-light dark:bg-text-dark rounded-xl flex items-center justify-center mb-6">
                            <Icon name="academic-cap" className="w-6 h-6 text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text-dark dark:text-background mb-3">Interactive Quizzes</h3>
                        <p className="text-gray-600 dark:text-primary-light text-sm">Test your knowledge with AI-generated quizzes for every module. Track your scores and progress over time.</p>
                    </div>
                </div>

                {/* How it Works Section */}
                <div id="how-it-works" className="mt-24 pt-12 border-t dark:border-primary">
                    <h2 className="text-3xl font-bold text-text-dark dark:text-background mb-12">How It Works</h2>
                    <div className="flex flex-col md:flex-row items-start justify-between space-y-12 md:space-y-0 md:space-x-8">
                        <div className="flex-1 flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold mb-4 shadow-sm">1</div>
                            <h4 className="font-bold mb-2 text-text-dark dark:text-background">Upload Document</h4>
                            <p className="text-sm text-gray-500 dark:text-primary-light text-center">Drop your PDF study notes, research papers, or textbooks into the creator.</p>
                        </div>
                        <div className="hidden md:block w-px h-16 bg-gray-200 dark:bg-primary self-center mt-4"></div>
                        <div className="flex-1 flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold mb-4 shadow-sm">2</div>
                            <h4 className="font-bold mb-2 text-text-dark dark:text-background">AI Generation</h4>
                            <p className="text-sm text-gray-500 dark:text-primary-light text-center">Gemini analyzes your content and structures a comprehensive learning path.</p>
                        </div>
                        <div className="hidden md:block w-px h-16 bg-gray-200 dark:bg-primary self-center mt-4"></div>
                        <div className="flex-1 flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold mb-4 shadow-sm">3</div>
                            <h4 className="font-bold mb-2 text-text-dark dark:text-background">Study & Quiz</h4>
                            <p className="text-sm text-gray-500 dark:text-primary-light text-center">Engage with summaries, take practice tests, and explore related materials.</p>
                        </div>
                    </div>
                </div>
                
                <div className="mt-20 py-10 bg-primary-light dark:bg-[#330D3D] rounded-3xl animate-fade-in-up">
                    <div className="flex flex-col items-center">
                        <Icon name="rocket" className="w-12 h-12 text-accent mb-4" />
                        <h2 className="text-2xl font-bold text-text-dark dark:text-background mb-4">Ready to start learning?</h2>
                        <button 
                            onClick={onGetStarted}
                            className="bg-accent text-white font-bold py-3 px-10 rounded-xl hover:opacity-90 shadow-md transition-all"
                        >
                            Launch App
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
                .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
                .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
                .delay-200 { animation-delay: 0.2s; }
                .delay-300 { animation-delay: 0.3s; }
                .delay-500 { animation-delay: 0.5s; }
            `}</style>
        </div>
    );
};

export default IntroPage;
