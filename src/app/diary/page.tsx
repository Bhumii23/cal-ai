"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Trash2, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";

interface FoodLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt?: string;
}

export default function DiaryPage() {
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Omit<FoodLog, "id"> | null>(null);
  const [showToast, setShowToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem("calAi_foodLogs");
    if (savedLogs) {
      try {
        setFoodLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Failed to parse food logs", e);
      }
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem("calAi_foodLogs", JSON.stringify(foodLogs));
  }, [foodLogs]);

  const totalCalories = foodLogs.reduce((sum, item) => sum + item.calories, 0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
      setAnalysisResult(null); // Clear previous result if any
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const base64String = await fileToBase64(selectedImage);
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: selectedImage.type,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysisResult(result);
      } else {
        const errData = await response.json();
        alert(`Failed to analyze: ${errData.error || 'Unknown error'}`);
        console.error("Failed to analyze image via API", errData);
      }
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : "Failed to analyze image"}`);
      console.error("Error analyzing image:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddToDiary = () => {
    if (!analysisResult) return;

    const newFood: FoodLog = {
      ...analysisResult,
      id: crypto.randomUUID(),
      loggedAt: new Date().toISOString(),
    };

    setFoodLogs((prev) => [newFood, ...prev]);
    
    // Reset states
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setAnalysisResult(null);
    
    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDelete = (id: string) => {
    setFoodLogs((prev) => prev.filter((log) => log.id !== id));
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-emerald-500/30 pb-24 font-sans relative">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
        {/* Header */}
        <header className="flex items-center gap-4 p-6 pt-8 sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-neutral-900">
          <Link
            href="/"
            className="p-2 -ml-2 hover:bg-neutral-900 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight flex-1 text-center pr-8">
            Food Diary
          </h1>
        </header>

        <div className="p-6 flex flex-col gap-8">
          {/* Upload Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
              Log Meal
            </h2>
            
            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />

              {!imagePreviewUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 bg-neutral-900/40 border-2 border-dashed border-neutral-800 rounded-3xl h-48 hover:bg-neutral-900/80 transition-colors"
                >
                  <div className="p-4 bg-neutral-800/80 rounded-full text-neutral-400">
                    <Camera className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-medium text-neutral-400">
                    Tap to upload or take photo
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="relative w-full rounded-[28px] overflow-hidden border border-neutral-800 bg-neutral-900/50 flex flex-col shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt="Food preview"
                      className={`w-full h-64 object-cover transition-opacity duration-300 ${isAnalyzing ? 'opacity-50 grayscale' : 'opacity-100'}`}
                    />
                    
                    {/* Analyzing Overlay Spinner */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 text-white animate-spin mb-4 shadow-lg" />
                        <span className="text-white font-bold tracking-wide drop-shadow-md">
                          Analyzing your food...
                        </span>
                      </div>
                    )}

                    {/* Actions if not analyzed yet */}
                    {!analysisResult && !isAnalyzing && (
                      <div className="p-4 flex gap-3 bg-neutral-900/80 backdrop-blur-md">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-800 rounded-2xl font-semibold text-sm hover:bg-neutral-700 transition-colors"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Retake
                        </button>
                        <button
                          onClick={handleAnalyze}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-black rounded-2xl font-bold text-sm hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                        >
                          <Camera className="w-4 h-4" />
                          Analyze Food
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Result Card */}
                  {analysisResult && (
                    <div className="flex flex-col p-6 bg-gradient-to-b from-neutral-900 to-black border border-neutral-800 rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-2xl font-black mb-1 leading-tight tracking-tight">
                        {analysisResult.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-3 mb-6">
                        <span className="text-5xl font-black tracking-tighter text-white">
                          {analysisResult.calories}
                        </span>
                        <div className="flex flex-col justify-end pb-1 text-emerald-400 font-bold">
                          <span className="text-xl leading-none">kcal</span>
                          <span className="text-lg leading-none">🔥</span>
                        </div>
                      </div>

                      {/* Macro Pills */}
                      <div className="flex gap-3 mb-8">
                        <div className="flex flex-col flex-1 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                          <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest mb-1">Protein</span>
                          <span className="font-bold text-blue-100">{analysisResult.protein}g</span>
                        </div>
                        <div className="flex flex-col flex-1 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                          <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-1">Carbs</span>
                          <span className="font-bold text-amber-100">{analysisResult.carbs}g</span>
                        </div>
                        <div className="flex flex-col flex-1 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                          <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest mb-1">Fat</span>
                          <span className="font-bold text-red-100">{analysisResult.fat}g</span>
                        </div>
                      </div>

                      <button
                        onClick={handleAddToDiary}
                        className="w-full py-4 bg-emerald-500 text-black font-black text-[17px] rounded-2xl hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                      >
                        Add to Diary
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Today's Log */}
          <section className="flex flex-col gap-4 mt-2">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
              Today&apos;s Log
            </h2>

            {foodLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-neutral-900/20 border border-neutral-800/30 rounded-3xl">
                <p className="text-sm font-medium text-neutral-500">No meals logged yet today.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {foodLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4.5 bg-neutral-900/40 border border-neutral-800/60 rounded-[24px] backdrop-blur-md group"
                  >
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-bold text-[15px] tracking-tight">{log.name}</h3>
                      <div className="flex gap-3 text-[11px] font-bold tracking-wide">
                        <span className="text-blue-400/90">{log.protein}g <span className="text-neutral-500">P</span></span>
                        <span className="text-amber-400/90">{log.carbs}g <span className="text-neutral-500">C</span></span>
                        <span className="text-red-400/90">{log.fat}g <span className="text-neutral-500">F</span></span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-black text-emerald-400 tracking-tight">{log.calories} kcal</span>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-2.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors active:scale-90"
                        aria-label="Delete food log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer Running Total */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none z-20">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between p-5 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-[24px] shadow-2xl pointer-events-auto">
              <span className="font-bold text-neutral-400 tracking-wide">Total Calories</span>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-black text-white tracking-tighter">{totalCalories}</span>
                <span className="text-sm text-neutral-500 font-bold pb-0.5">kcal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Success Toast Notification */}
        {showToast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 px-5 py-3.5 bg-emerald-500 text-black font-bold rounded-full shadow-[0_0_40px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-5 h-5" />
              <span>Food added!</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
