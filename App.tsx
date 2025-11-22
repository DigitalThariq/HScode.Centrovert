import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, ArrowRight, Loader2, Info, ChevronRight, Container, Camera, X, ScanLine, Moon, Sun, Mic } from 'lucide-react';
import { identifyHSCode } from './services/geminiService';
import { HSCodeResult, TargetRegion } from './types';
import { RegionSelector } from './components/RegionSelector';
import { ResultCard } from './components/ResultCard';

// Custom Logo Component - Hexagon C
const CentrovertLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 5 L85 25 L85 65 L50 85 L15 65 L15 25 Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="opacity-0" />
    <path d="M20 35 L50 18 L80 35" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 65 L50 82 L80 65" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M65 40 C60 32 40 32 35 40 C28 48 28 52 35 60 C40 68 60 68 65 60" stroke="currentColor" strokeWidth="10" strokeLinecap="round"/>
  </svg>
);

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [region, setRegion] = useState<TargetRegion>(TargetRegion.SINGAPORE);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [result, setResult] = useState<HSCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Image State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);

  // Toggle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && !imagePreview) return;

    setLoading(true);
    setLoadingStatus("Preparing analysis...");
    setError(null);
    setResult(null);

    try {
      const data = await identifyHSCode(input, region, imagePreview || undefined, (status) => {
        setLoadingStatus(status);
      });
      setResult(data);
    } catch (err) {
      setError("Failed to classify product. Please ensure the description or image is clear.");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (text: string) => {
    setInput(text);
    setImagePreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognition.start();
    } else {
      alert("Voice input is not supported in this browser.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 bg-slate-50 dark:bg-slate-950">
      
      {/* Navbar - Navy Blue */}
      <header className="sticky top-0 z-50 bg-navy text-white shadow-lg transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1">
               <CentrovertLogo className="w-8 h-8 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              HScode.<span className="text-electric text-opacity-90">Centrovert</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4">
              <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Docs</a>
              <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">API</a>
            </div>
            
            <span className="h-5 w-px bg-slate-600 hidden sm:block"></span>
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow px-4 py-12 relative">
        
        <div className="max-w-5xl mx-auto space-y-10">
          
          {/* Hero Section */}
          <div className="text-center space-y-6 max-w-3xl mx-auto animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 text-xs font-bold text-navy dark:text-blue-300 uppercase tracking-wider mb-2 shadow-sm">
                <Sparkles className="w-3 h-3 text-electric" /> Intelligent Trade Compliance
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-navy dark:text-white leading-tight">
              Accelerate Global Trade with <span className="text-electric">AI Precision</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Instantly classify products with our advanced HS Code engine optimized for Singapore, GCC, and International markets.
            </p>
          </div>

          {/* Main Input Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/50 border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300">
             
             <div className="p-6 sm:p-10">
                <RegionSelector selectedRegion={region} onRegionChange={setRegion} />
                
                <div className="space-y-4 mt-8">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-navy dark:text-white pl-1">
                           Product Description
                        </label>
                        <span className="text-xs font-medium text-electric uppercase tracking-wider">
                           Text or Image
                        </span>
                    </div>

                    {/* Image Preview Thumbnail */}
                    {imagePreview && (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-electric shadow-md group">
                            <img src={imagePreview} alt="Product Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-navy/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                    onClick={removeImage}
                                    className="p-1.5 bg-white rounded-full text-electric hover:scale-110 transition-transform"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {loading && (
                                <div className="absolute inset-0 bg-navy/20 flex flex-col items-center justify-center">
                                    <div className="w-full h-0.5 bg-electric shadow-[0_0_10px_#0066ff] animate-[scan_2s_ease-in-out_infinite]" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="e.g., 'Wireless Bluetooth Headphones' or upload a product image..."
                            className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-5 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-electric dark:focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-all resize-none ${imagePreview ? 'min-h-[100px]' : 'min-h-[160px]'}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                        />
                        
                        {/* Floating Action Bar */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                             {/* Hidden File Input */}
                             <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                accept="image/*" 
                                className="hidden" 
                             />
                             
                             <button
                                onClick={startListening}
                                className={`p-2 rounded-md transition-all ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-electric hover:bg-blue-50 dark:hover:bg-slate-800'}`}
                                title="Voice Input"
                             >
                                <Mic className="w-5 h-5" />
                             </button>

                             <button
                                onClick={triggerCamera}
                                className="text-slate-400 hover:text-electric hover:bg-blue-50 dark:hover:bg-slate-800 p-2 rounded-md transition-all"
                                title="Upload Image"
                             >
                                <Camera className="w-5 h-5" />
                             </button>

                             <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                             <button
                                onClick={(e) => handleSearch(e)}
                                disabled={loading || (!input && !imagePreview)}
                                className="bg-electric hover:bg-blue-600 text-white rounded-md px-6 py-2 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-95"
                             >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                    {imagePreview ? 'Scan' : 'Classify'} <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
             </div>

             {/* Suggestions Bar */}
             {!result && !imagePreview && (
                 <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-10 py-4 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium mr-2 text-xs uppercase tracking-wide">Quick Search:</span>
                    {[
                        "Polypropylene lunch boxes", 
                        "Cotton Men's T-Shirt", 
                        "Solar Panels"
                    ].map((ex) => (
                        <button 
                            key={ex}
                            onClick={() => loadExample(ex)}
                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:border-electric hover:text-electric dark:hover:border-electric transition-all text-xs font-medium shadow-sm"
                        >
                            {ex}
                        </button>
                    ))}
                 </div>
             )}
          </div>

          {/* Loading State */}
          {loading && !result && (
            <div className="w-full max-w-2xl mx-auto text-center py-12 animate-pulse">
                <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full mx-auto mb-6 flex items-center justify-center text-electric shadow-lg shadow-blue-100 dark:shadow-none">
                    {imagePreview ? <ScanLine className="w-8 h-8 animate-pulse" /> : <Loader2 className="w-8 h-8 animate-spin" />}
                </div>
                <h3 className="text-xl font-bold text-navy dark:text-white transition-all duration-300">
                  {loadingStatus}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Cross-referencing tariff schedules for {region}</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-white dark:bg-slate-900 border-l-4 border-red-500 rounded-r-xl p-6 flex items-start gap-4 shadow-md">
                <Info className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-navy dark:text-white text-lg">Analysis Interrupted</h4>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{error}</p>
                </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="animate-in slide-in-from-bottom-6 duration-700 pb-20">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-2xl font-bold text-navy dark:text-white flex items-center gap-3">
                        <Container className="w-6 h-6 text-electric" />
                        Classification Results
                    </h2>
                    <button 
                        onClick={() => { setResult(null); setInput(''); setImagePreview(null); }}
                        className="text-sm font-semibold text-slate-500 hover:text-electric transition-colors flex items-center gap-1"
                    >
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>
                <ResultCard result={result} region={region} />
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <CentrovertLogo className="w-5 h-5 text-navy dark:text-white" />
            <span>&copy; 2024 HScode.Centrovert</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-slate-500">
            <a href="#" className="hover:text-electric transition-colors">Legal</a>
            <a href="#" className="hover:text-electric transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-electric transition-colors">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;