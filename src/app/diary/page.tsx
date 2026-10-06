"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Trash2, Loader2, Image as ImageIcon, CheckCircle2, Flame } from "lucide-react";
import { useRequireAuth } from "@/lib/auth";
import { addFoodLog, deleteFoodLog, loadFoodLogs } from "@/lib/db";

interface FoodLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt?: string;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLogDateKey(log: FoodLog, todayKey: string) {
  const rawDate = log.loggedAt;
  if (!rawDate) return todayKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? todayKey : getDateKey(parsed);
}

export default function DiaryPage() {
  const { authLoading } = useRequireAuth();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Omit<FoodLog, "id"> | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Load from Supabase (or localStorage fallback) after auth is ready
  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      try {
        setFoodLogs(await loadFoodLogs());
      } catch (e) {
        console.error("Failed to load food logs", e);
      } finally {
        setHasLoadedLogs(true);
      }
    })();
  }, [authLoading]);

  const todayKey = getDateKey(new Date());
  const todayLogs = foodLogs.filter((log) => getLogDateKey(log, todayKey) === todayKey);
  const totalCalories = todayLogs.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same photo again still fires onChange.
    e.target.value = "";
    setShowSourcePicker(false);
    if (!file) return;
    // Keep uploads small so the base64 body doesn't exceed server limits.
    if (file.size > 4 * 1024 * 1024) {
      alert("That photo is too large. Please pick an image under 4MB.");
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null); // Clear previous result if any
  };

  // Free the preview URL when leaving the page.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

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
        let message = "Unknown error";
        try {
          const errData = await response.json();
          message = errData.error || message;
        } catch {
          message = `Server returned ${response.status}`;
        }
        alert(`Failed to analyze: ${message}`);
        console.error("Failed to analyze image via API", message);
      }
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : "Failed to analyze image"}`);
      console.error("Error analyzing image:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddToDiary = async () => {
    if (!analysisResult) return;

    const toNonNegative = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.max(0, num) : 0;
    };
    try {
      const newFood = await addFoodLog({
        name: String(analysisResult.name || "Logged meal"),
        calories: toNonNegative(analysisResult.calories),
        protein: toNonNegative(analysisResult.protein),
        carbs: toNonNegative(analysisResult.carbs),
        fat: toNonNegative(analysisResult.fat),
        loggedAt: new Date().toISOString(),
      });
      setFoodLogs((prev) => [newFood, ...prev]);
    } catch (err) {
      console.error("Failed to save food log", err);
      return;
    }

    // Reset states
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setAnalysisResult(null);
    
    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDelete = async (id: string) => {
    setFoodLogs((prev) => prev.filter((log) => log.id !== id));
    try {
      await deleteFoodLog(id);
    } catch (err) {
      console.error("Failed to delete food log", err);
    }
  };

  if (authLoading) {
    return (
      <main className="app-shell relative min-h-screen pb-28 text-white md:pb-8 md:pl-64">
        <div className="p-6 md:px-8"><div className="skeleton h-48 rounded-[28px]" /></div>
      </main>
    );
  }

  return (
    <main className="app-shell relative min-h-screen pb-28 font-sans text-white selection:bg-green-500/30 md:pb-8 md:pl-64">
      <div className="flex min-h-screen flex-col">
        {/* Header — sticky only, no animated/transformed ancestor so it stays put */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b border-white/10 bg-neutral-950/65 p-6 pt-8 backdrop-blur-2xl">
          <Link
            href="/"
            className="-ml-2 rounded-full p-2 transition-all duration-300 hover:bg-white/10 active:scale-90"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="gradient-heading flex-1 pr-8 text-center text-xl font-black">
            Food Diary
          </h1>
        </header>

        <div className="page-enter flex flex-1 flex-col gap-8 p-6 md:px-8 md:py-6">
          {/* Upload Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-green-400">
              Log Meal
            </h2>
            
            <div className="flex flex-col gap-4">
              {/* Gallery: photo library / files */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
              {/* Camera: opens the device camera directly on mobile */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={cameraInputRef}
                onChange={handleImageChange}
              />

              {!imagePreviewUrl ? (
                <>
                <button
                  onClick={() => setShowSourcePicker(true)}
                  className="glass-card group flex h-52 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-green-500/45 transition-all duration-300 hover:-translate-y-1 hover:border-green-400 hover:bg-green-500/10 active:scale-[0.98]"
                >
                  <div className="rounded-full border border-green-500/25 bg-green-500/15 p-4 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.18)] transition-transform duration-300 group-hover:scale-110">
                    <Camera className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-bold text-neutral-200">
                    Tap to upload food photo
                  </span>
                  <span className="text-xs font-medium text-neutral-500">Camera or gallery</span>
                </button>

                {/* Source picker: Camera vs Gallery */}
                {showSourcePicker && (
                  <div className="glass-card flex flex-col gap-3 rounded-[24px] p-4">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-500 py-3.5 text-sm font-black text-black shadow-[0_0_24px_rgba(34,197,94,0.25)] transition-all duration-300 hover:bg-green-400 active:scale-[0.97]"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-white/15 active:scale-[0.97]"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Choose from Gallery
                    </button>
                    <button
                      onClick={() => setShowSourcePicker(false)}
                      className="py-1 text-xs font-bold text-neutral-500 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="glass-card relative flex w-full flex-col overflow-hidden rounded-[28px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt="Food preview"
                      className={`h-72 w-full bg-black/30 object-contain sm:h-80 md:h-[28rem] transition-opacity duration-300 ${isAnalyzing ? 'opacity-50 grayscale' : 'opacity-100'}`}
                    />
                    
                    {/* Analyzing Overlay Spinner */}
                    {isAnalyzing && (
                      <div className="img-overlay-dark absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
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
                          onClick={() => setShowSourcePicker(true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-white/15 active:scale-[0.97]"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Retake
                        </button>
                        <button
                          onClick={handleAnalyze}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-500 py-3.5 text-sm font-black text-black shadow-[0_0_24px_rgba(34,197,94,0.25)] transition-all duration-300 hover:bg-green-400 active:scale-[0.97]"
                        >
                          <Camera className="w-4 h-4" />
                          Analyze Food
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Retake source picker: Camera vs Gallery */}
                  {showSourcePicker && !isAnalyzing && !analysisResult && (
                    <div className="glass-card flex flex-col gap-3 rounded-[24px] p-4">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-500 py-3.5 text-sm font-black text-black shadow-[0_0_24px_rgba(34,197,94,0.25)] transition-all duration-300 hover:bg-green-400 active:scale-[0.97]"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-white/15 active:scale-[0.97]"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Choose from Gallery
                      </button>
                      <button
                        onClick={() => setShowSourcePicker(false)}
                        className="py-1 text-xs font-bold text-neutral-500 hover:text-neutral-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Result Card */}
                  {analysisResult && (
                    <div className="glass-card flex animate-in flex-col rounded-[28px] p-6 fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-2xl font-black mb-1 leading-tight tracking-tight">
                        {analysisResult.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-3 mb-6">
                        <span className="text-5xl font-black tracking-tighter text-white">
                          {analysisResult.calories}
                        </span>
                        <div className="flex flex-col justify-end pb-1 font-bold text-green-400">
                          <span className="text-xl leading-none">kcal</span>
                          <Flame className="mt-1 h-4 w-4 fill-green-500 text-green-500" />
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
                        className="w-full rounded-2xl bg-green-500 py-4 text-[17px] font-black text-black shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-400 active:scale-[0.98]"
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

            {!hasLoadedLogs ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((item) => <div key={item} className="skeleton h-20 rounded-3xl" />)}
              </div>
            ) : todayLogs.length === 0 ? (
              <div className="glass-card flex flex-col items-center justify-center rounded-3xl py-10">
                <p className="text-sm font-medium text-neutral-500">No meals logged yet today.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {todayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="glass-card group flex items-center justify-between gap-3 rounded-[24px] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-500/20"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <h3 className="break-words font-bold text-[15px] leading-snug tracking-tight">{log.name}</h3>
                      <div className="flex flex-wrap gap-3 text-[11px] font-bold tracking-wide">
                        <span className="text-blue-400/90">{log.protein}g <span className="text-neutral-500">P</span></span>
                        <span className="text-amber-400/90">{log.carbs}g <span className="text-neutral-500">C</span></span>
                        <span className="text-red-400/90">{log.fat}g <span className="text-neutral-500">F</span></span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <span className="whitespace-nowrap font-black tracking-tight text-green-400">{log.calories} kcal</span>
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

          {/* Total Calories — in normal flow, always AFTER the full food list.
              Never fixed/absolute, so it moves down as items are added. */}
          <div className="mt-2 flex flex-col">
            <div className="glass-card flex items-center justify-between rounded-[24px] p-5">
              <span className="font-bold text-neutral-400 tracking-wide">Total Calories</span>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-black text-white tracking-tighter">{totalCalories}</span>
                <span className="text-sm text-neutral-500 font-bold pb-0.5">kcal</span>
              </div>
            </div>
            {/* Spacer so content never hides behind the fixed bottom nav */}
            <div aria-hidden className="h-6 md:hidden" />
          </div>
        </div>

        {/* Success Toast Notification */}
        {showToast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-3.5 font-bold text-black shadow-[0_0_40px_rgba(34,197,94,0.4)]">
              <CheckCircle2 className="w-5 h-5" />
              <span>Food added!</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
