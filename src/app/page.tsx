"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Flame, Play, Plus, Sparkles } from "lucide-react";

const FOOD_LOGS_KEY = "calAi_foodLogs";
const GOALS_KEY = "calAi_goals";

interface FoodLog {
  id?: string;
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  loggedAt?: string;
  createdAt?: string;
  date?: string;
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  title?: string;
  subtitle?: string;
  titleClass?: string;
}

const DEFAULT_GOALS: Goals = { calories: 2000, protein: 120, carbs: 250, fat: 60 };
const QUICK_FOODS = [
  { name: "Apple", emoji: "🍎", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Rice", emoji: "🍚", calories: 206, protein: 4, carbs: 45, fat: 0 },
  { name: "Milk", emoji: "🥛", calories: 122, protein: 8, carbs: 12, fat: 5 },
];

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
}

function getLogDateKey(log: FoodLog, todayKey: string) {
  const rawDate = log.loggedAt || log.createdAt || log.date;
  if (!rawDate) return todayKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const parsedDate = new Date(rawDate);
  return Number.isNaN(parsedDate.getTime()) ? todayKey : getDateKey(parsedDate);
}

function parseStoredLogs(rawLogs: string | null): FoodLog[] {
  if (!rawLogs) return [];

  try {
    const parsed: unknown = JSON.parse(rawLogs);
    if (Array.isArray(parsed)) {
      return parsed.filter((log): log is FoodLog => typeof log === "object" && log !== null);
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed).flatMap(([date, logs]) =>
        Array.isArray(logs)
          ? logs
              .filter((log): log is FoodLog => typeof log === "object" && log !== null)
              .map((log) => ({ ...log, date: log.date || date }))
          : []
      );
    }
  } catch (error) {
    console.error("Failed to parse food logs", error);
  }

  return [];
}

function parseSavedGoals(rawGoals: string | null): Goals {
  if (!rawGoals) return DEFAULT_GOALS;
  try {
    const parsed = JSON.parse(rawGoals) as Partial<Goals>;
    return {
      calories: Number(parsed.calories) || DEFAULT_GOALS.calories,
      protein: Number(parsed.protein) || DEFAULT_GOALS.protein,
      carbs: Number(parsed.carbs) || DEFAULT_GOALS.carbs,
      fat: Number(parsed.fat) || DEFAULT_GOALS.fat,
    };
  } catch (error) {
    console.error("Failed to parse saved goals", error);
    return DEFAULT_GOALS;
  }
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getStreak(logs: FoodLog[]) {
  const todayKey = getDateKey(new Date());
  const loggedDates = new Set(logs.map((log) => getLogDateKey(log, todayKey)));
  let streak = 0;
  let cursor = todayKey;
  while (loggedDates.has(cursor)) {
    streak += 1;
    cursor = getPreviousDateKey(cursor);
  }
  return streak;
}

function getProgress(value: number, goal: number) {
  return goal > 0 ? (value / goal) * 100 : 0;
}

function getMealEmoji(name = "") {
  const match = QUICK_FOODS.find((food) => food.name.toLowerCase() === name.toLowerCase());
  return match?.emoji || "🍽️";
}

function ProgressRing({ radius, stroke, progress, color, title, subtitle, titleClass = "text-4xl font-black" }: ProgressRingProps) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle stroke="rgba(255,255,255,0.07)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
        <circle stroke={color} fill="transparent" strokeWidth={stroke} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        {title && <span className={titleClass}>{title}</span>}
        {subtitle && <span className="mt-1 text-sm font-semibold text-neutral-400">{subtitle}</span>}
      </div>
    </div>
  );
}

const LANDING_STATS = [
  ["10K+", "Meals Tracked"],
  ["98%", "AI Accuracy"],
  ["50+", "Indian Foods Recognized"],
];

const FEATURE_PILLS = {
  diary: ["AI food recognition", "Instant macro breakdown", "Indian meals included"],
  macros: ["Protein, carbs and fats", "Personal calorie goals", "At-a-glance progress"],
};

function FeatureImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="landing-card mx-auto max-w-lg rounded-2xl bg-white p-2 shadow-2xl">
      <img src={src} alt={alt} className="h-[300px] w-full rounded-xl object-cover" />
    </div>
  );
}

export default function Home() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = () => {
      setLogs(parseStoredLogs(localStorage.getItem(FOOD_LOGS_KEY)));
      setGoals(parseSavedGoals(localStorage.getItem(GOALS_KEY)));
      setIsLoading(false);
    };
    loadDashboard();
    window.addEventListener("storage", loadDashboard);
    window.addEventListener("focus", loadDashboard);
    return () => {
      window.removeEventListener("storage", loadDashboard);
      window.removeEventListener("focus", loadDashboard);
    };
  }, []);

  useEffect(() => {
    const revealElements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.16 }
    );
    revealElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const todayKey = getDateKey(new Date());
  const todayLogs = logs.filter((log) => getLogDateKey(log, todayKey) === todayKey);
  const totals = todayLogs.reduce<NutritionTotals>(
    (sum, log) => ({
      calories: sum.calories + toNumber(log.calories),
      protein: sum.protein + toNumber(log.protein),
      carbs: sum.carbs + toNumber(log.carbs),
      fat: sum.fat + toNumber(log.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const remainingCalories = Math.max(goals.calories - totals.calories, 0);
  const macros = [
    { label: "Protein", value: totals.protein, goal: goals.protein, color: "#60a5fa" },
    { label: "Carbs", value: totals.carbs, goal: goals.carbs, color: "#fbbf24" },
    { label: "Fat", value: totals.fat, goal: goals.fat, color: "#fb7185" },
  ];

  const handleQuickAdd = (food: (typeof QUICK_FOODS)[number]) => {
    const newLog: FoodLog = {
      ...food,
      id: crypto.randomUUID(),
      loggedAt: new Date().toISOString(),
    };
    const updatedLogs = [newLog, ...logs];
    localStorage.setItem(FOOD_LOGS_KEY, JSON.stringify(updatedLogs));
    setLogs(updatedLogs);
  };

  return (
    <main className="app-shell min-h-screen pb-24 text-white selection:bg-green-500/30 md:pb-0 md:pl-64">
      <div className="page-enter min-h-screen">
        <section className="relative overflow-hidden border-b border-green-500/15 bg-gradient-to-br from-green-950 via-neutral-950 to-black px-6 py-16 shadow-[0_18px_50px_rgba(0,0,0,0.35)] md:px-10 md:py-24 lg:px-16">
          <div className="pointer-events-none absolute -right-16 -top-12 h-72 w-72 rounded-full bg-green-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-6">
            <div className="max-w-4xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-green-400">AI-powered nutrition tracking</p>
              <h1 className="animated-gradient-text heading-font mt-5 text-5xl font-black tracking-[-0.06em] sm:text-6xl lg:text-8xl">Snap. Analyze. Track.</h1>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-neutral-400 sm:text-base">Turn every plate into clear, useful nutrition insights. Track calories and macros in seconds, then build healthier habits meal by meal.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#dashboard" className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-3 text-sm font-black text-neutral-950 transition-all duration-300 hover:-translate-y-1 hover:bg-green-400 hover:shadow-[0_12px_28px_rgba(34,197,94,0.3)]">Start Tracking <ArrowRight className="h-4 w-4" /></a>
                <a href="#features" className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-black text-white transition-all duration-300 hover:-translate-y-1 hover:border-green-400/50 hover:bg-green-500/10"><Play className="h-4 w-4 fill-white" /> Watch Demo</a>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-400/30 bg-green-500/15 text-sm font-black text-green-100 shadow-[0_0_24px_rgba(34,197,94,0.25)] md:hidden">BH</div>
          </div>
          <div className="relative mt-10 flex items-center gap-2 text-xs font-bold text-green-300">
            <Flame className="h-4 w-4 fill-green-500 text-green-500" />
            {getStreak(logs)} day streak
          </div>
        </section>

        <section className="grid grid-cols-1 border-b border-white/10 bg-neutral-950/80 px-6 py-2 sm:grid-cols-3 md:px-8">
          {LANDING_STATS.map(([value, label], index) => (
            <div key={label} className="stat-enter border-b border-white/10 px-4 py-5 text-center last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0" style={{ animationDelay: `${index * 140 + 120}ms` }}>
              <p className="heading-font text-2xl font-black text-green-400">{value}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{label}</p>
            </div>
          ))}
        </section>

        <div id="dashboard" className="grid scroll-mt-4 gap-6 px-5 py-8 md:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] md:gap-8 md:px-8 md:py-10">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="card-shimmer glass-card relative flex flex-col items-center rounded-[28px] border-green-500/30 px-4 py-6 shadow-[0_0_48px_rgba(34,197,94,0.14)]">
              <div className="absolute inset-5 rounded-full bg-green-500/10 blur-3xl" />
              <p className="relative mb-1 text-[10px] font-black uppercase tracking-[0.24em] text-green-400">Daily Calories</p>
              {isLoading ? <div className="skeleton mt-3 h-[272px] w-[272px] rounded-full" /> : <ProgressRing radius={136} stroke={14} progress={getProgress(totals.calories, goals.calories)} color="#22c55e" title={Math.round(totals.calories).toLocaleString()} subtitle={`of ${goals.calories.toLocaleString()} kcal`} />}
              <p className="relative mt-3 text-sm font-bold text-neutral-400"><span className="text-white">{Math.round(remainingCalories).toLocaleString()}</span> kcal remaining</p>
            </section>

            <section className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-green-500/20 bg-green-500/10">
                  <Flame className="h-5 w-5 fill-green-500 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Current streak</p>
                  <p className="mt-1 text-xl font-black text-white">{getStreak(logs)} days</p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="gradient-heading text-lg font-black">Quick Add</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Recent foods</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_FOODS.map((food) => (
                  <button key={food.name} type="button" onClick={() => handleQuickAdd(food)} className="glass-card flex items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 hover:border-green-500/35 hover:bg-green-500/10 active:scale-95">
                    <span>{food.emoji}</span>{food.name}<Plus className="h-3.5 w-3.5 text-green-400" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="grid grid-cols-3 gap-3">
              {macros.map((macro) => (
                <div key={macro.label} className="card-shimmer glass-card rounded-2xl p-4 text-center md:p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{macro.label}</p>
                  <p className="mt-3 text-2xl font-black" style={{ color: macro.color }}>{Math.round(macro.value)}g</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(getProgress(macro.value, macro.goal), 100)}%`, backgroundColor: macro.color }} /></div>
                  <p className="mt-3 text-[10px] font-bold text-neutral-500">{macro.goal}g goal</p>
                </div>
              ))}
            </section>

            <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="gradient-heading text-lg font-black">Today&apos;s Meals</h2>
              <Link href="/diary" className="flex items-center gap-1 text-xs font-black text-green-400 transition-colors hover:text-green-300">View All <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="flex flex-col gap-2.5">
              {todayLogs.length === 0 ? (
                <div className="glass-card rounded-2xl p-5 text-center text-sm font-medium text-neutral-500">No meals logged yet. Start with a quick add.</div>
              ) : todayLogs.slice(0, 3).map((log, index) => (
                <article key={log.id || `${log.name}-${index}`} className="glass-card card-shimmer flex items-center gap-3 rounded-2xl p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-500/20">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">{getMealEmoji(log.name)}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black text-neutral-100">{log.name || "Logged meal"}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Today</p>
                  </div>
                  <p className="text-sm font-black text-green-400">{Math.round(toNumber(log.calories))} kcal</p>
                </article>
              ))}
            </div>
          </section>

            <section className="card-shimmer rounded-2xl border border-green-500/20 bg-gradient-to-r from-green-500/15 to-neutral-900/60 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
              <p className="text-sm font-bold leading-relaxed text-green-100">Every healthy choice brings you closer to your goal 💪</p>
            </section>
          </div>
        </div>

        <section id="features" className="border-t border-white/10 bg-neutral-950/65 px-5 py-20 md:px-8 lg:px-14">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-20 max-w-2xl text-center" data-reveal="up">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-green-400">Built for everyday meals</p>
              <h2 className="heading-font mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Simple tracking. Useful insights.</h2>
              <p className="mt-4 text-sm leading-7 text-neutral-400">Everything you need to stay aware of what you eat, without turning every meal into homework.</p>
            </div>

            <div className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
              <div data-reveal="left"><FeatureImage src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80" alt="Fresh salad bowl" /></div>
              <div data-reveal="right">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">01 · Snap</p>
                <h2 className="heading-font mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Snap a photo, get instant nutrition</h2>
                <p className="mt-4 text-sm leading-7 text-neutral-400">Log what is on your plate with a photo and get a clear calorie and macro estimate in moments.</p>
                <div className="mt-6 flex flex-wrap gap-2">{FEATURE_PILLS.diary.map((pill) => <span key={pill} className="feature-pill"><Check className="h-3.5 w-3.5" />{pill}</span>)}</div>
              </div>
            </div>

            <div className="grid items-center gap-10 py-20 lg:grid-cols-2 lg:gap-16">
              <div className="lg:order-2" data-reveal="right"><FeatureImage src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=500&q=80" alt="Healthy meal ingredients" /></div>
              <div className="lg:order-1" data-reveal="left">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">02 · Understand</p>
                <h2 className="heading-font mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Track your daily macros</h2>
                <p className="mt-4 text-sm leading-7 text-neutral-400">See how protein, carbs and fats fit your goals with a dashboard that stays easy to read all day.</p>
                <div className="mt-6 flex flex-wrap gap-2">{FEATURE_PILLS.macros.map((pill) => <span key={pill} className="feature-pill"><Check className="h-3.5 w-3.5" />{pill}</span>)}</div>
              </div>
            </div>

            <div className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
              <div data-reveal="left"><FeatureImage src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&q=80" alt="Fitness and wellness routine" /></div>
              <div data-reveal="right">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">03 · Improve</p>
                <h2 className="heading-font mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">See your weekly progress</h2>
                <p className="mt-4 text-sm leading-7 text-neutral-400">Spot patterns across the week, understand your consistency, and make the next healthy choice with confidence.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-black px-6 py-10 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-7">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <p className="heading-font flex items-center gap-2 text-xl font-black text-white"><Flame className="h-5 w-5 fill-green-500 text-green-400" />Cal AI</p>
                <p className="mt-2 text-xs font-medium text-neutral-500">Good choices, one meal at a time.</p>
              </div>
              <div className="flex flex-wrap gap-5 text-xs font-bold text-neutral-400">
                <a className="transition-colors hover:text-green-400" href="#dashboard">Dashboard</a>
                <a className="transition-colors hover:text-green-400" href="#features">Features</a>
                <Link className="transition-colors hover:text-green-400" href="/diary">Diary</Link>
                <Link className="transition-colors hover:text-green-400" href="/goals">Goals</Link>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-widest text-neutral-600 sm:flex-row sm:items-center">
              <p>© 2026 Cal AI. All rights reserved.</p>
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-green-400"><Sparkles className="h-3 w-3" />Powered by Groq AI</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
