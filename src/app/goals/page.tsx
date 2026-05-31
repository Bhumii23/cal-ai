"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Beef, CheckCircle2, Flame, Gauge, Wheat } from "lucide-react";

const FOOD_LOGS_KEY = "calAi_foodLogs";
const GOALS_KEY = "calAi_goals";

interface FoodLog {
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

interface StreakStats {
  current: number;
  best: number;
}

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 60,
};

const goalFields = [
  {
    key: "calories",
    label: "Daily calorie goal",
    unit: "kcal",
    icon: Gauge,
    color: "text-green-400",
    iconBackground: "bg-green-500/10 border-green-500/20",
  },
  {
    key: "protein",
    label: "Protein goal",
    unit: "grams",
    icon: Beef,
    color: "text-blue-400",
    iconBackground: "bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "carbs",
    label: "Carbs goal",
    unit: "grams",
    icon: Wheat,
    color: "text-amber-400",
    iconBackground: "bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "fat",
    label: "Fat goal",
    unit: "grams",
    icon: Flame,
    color: "text-red-400",
    iconBackground: "bg-red-500/10 border-red-500/20",
  },
] as const;

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

  if (!rawDate) {
    return todayKey;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  const parsedDate = new Date(rawDate);
  return Number.isNaN(parsedDate.getTime()) ? todayKey : getDateKey(parsedDate);
}

function parseStoredLogs(rawLogs: string | null): FoodLog[] {
  if (!rawLogs) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawLogs);

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (log): log is FoodLog => typeof log === "object" && log !== null
      );
    }

    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed).flatMap(([date, logs]) =>
        Array.isArray(logs)
          ? logs
              .filter(
                (log): log is FoodLog =>
                  typeof log === "object" && log !== null
              )
              .map((log) => ({ ...log, date: log.date || date }))
          : []
      );
    }
  } catch (error) {
    console.error("Failed to parse food logs for streak", error);
  }

  return [];
}

function calculateStreak(logs: FoodLog[]): StreakStats {
  const todayKey = getDateKey(new Date());
  const loggedDates = new Set(logs.map((log) => getLogDateKey(log, todayKey)));

  let current = 0;
  let cursor = todayKey;

  while (loggedDates.has(cursor)) {
    current += 1;
    cursor = getPreviousDateKey(cursor);
  }

  const sortedDates = Array.from(loggedDates).sort();
  let best = 0;
  let running = 0;
  let previousDate: string | null = null;

  sortedDates.forEach((date) => {
    running = previousDate && getPreviousDateKey(date) === previousDate ? running + 1 : 1;
    best = Math.max(best, running);
    previousDate = date;
  });

  return { current, best };
}

function parseSavedGoals(rawGoals: string | null): Goals {
  if (!rawGoals) {
    return DEFAULT_GOALS;
  }

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

function getMotivationalMessage(streak: number) {
  if (streak === 0) {
    return "Start your journey!";
  }

  if (streak <= 3) {
    return "Great start! Keep going!";
  }

  if (streak >= 7) {
    return "You're on fire! 🔥";
  }

  return "Momentum looks good. Keep showing up!";
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [streak, setStreak] = useState<StreakStats>({ current: 0, best: 0 });
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setGoals(parseSavedGoals(localStorage.getItem(GOALS_KEY)));
    setStreak(calculateStreak(parseStoredLogs(localStorage.getItem(FOOD_LOGS_KEY))));
    setIsLoading(false);
  }, []);

  const updateGoal = (key: keyof Goals, value: string) => {
    setGoals((currentGoals) => ({
      ...currentGoals,
      [key]: Math.max(0, Number(value)),
    }));
  };

  const handleSave = () => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2600);
  };

  return (
    <main className="app-shell min-h-screen overflow-hidden pb-28 text-white selection:bg-green-500/30 md:pb-8 md:pl-64">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_62%)]" />

      <div className="page-enter relative min-h-screen">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/10 bg-neutral-950/65 p-6 pt-8 backdrop-blur-2xl">
          <Link
            href="/"
            className="-ml-2 rounded-full p-2 transition-all duration-300 hover:bg-white/10 active:scale-90"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="gradient-heading flex-1 pr-8 text-center text-xl font-black">
            Goals &amp; Streak
          </h1>
        </header>

        <div className="flex flex-col gap-8 p-6 md:px-8 md:py-6">
          <section className="glass-card history-fade-up relative overflow-hidden rounded-[32px] border-green-500/20 bg-green-500/10 p-6 text-center shadow-[0_20px_70px_rgba(34,197,94,0.14)]">
            <div className="pointer-events-none absolute left-1/2 top-5 h-36 w-36 -translate-x-1/2 rounded-full bg-green-400/15 blur-3xl" />
            <Flame className="goals-flame relative mx-auto mb-3 h-16 w-16 fill-green-500 text-green-400 drop-shadow-[0_0_24px_rgba(34,197,94,0.42)]" />
            <p className="relative text-7xl font-black tracking-tighter text-white">
              {isLoading ? <span className="skeleton mx-auto block h-16 w-20 rounded-xl" /> : streak.current}
            </p>
            <p className="relative mt-1 text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
              Day Streak
            </p>
            <p className="relative mt-4 text-sm font-medium text-neutral-400">
              {getMotivationalMessage(streak.current)}
            </p>

            <div className="relative mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <Award className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-neutral-400">Best streak</span>
              <span className="text-sm font-black text-white">{streak.best} days</span>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                Daily Goals
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Tune your targets to match the pace you want to keep.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {goalFields.map((field, index) => {
                const Icon = field.icon;

                return (
                  <label
                    key={field.key}
                    className="glass-card history-fade-up group flex items-center gap-4 rounded-[22px] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-500/20"
                    style={{ animationDelay: `${120 + index * 60}ms` }}
                  >
                    <span className={`rounded-2xl border p-3 ${field.iconBackground}`}>
                      <Icon className={`h-5 w-5 ${field.color}`} />
                    </span>

                    <span className="flex flex-1 flex-col gap-1">
                      <span className="text-sm font-bold tracking-tight text-neutral-200">
                        {field.label}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        Per day
                      </span>
                    </span>

                    <span className="flex items-baseline gap-1 rounded-xl border border-neutral-800 bg-black/40 px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={goals[field.key]}
                        onChange={(event) => updateGoal(field.key, event.target.value)}
                        className="w-16 bg-transparent text-right text-lg font-black tracking-tight text-white outline-none"
                        aria-label={field.label}
                      />
                      <span className="text-[10px] font-bold uppercase text-neutral-600">
                        {field.unit}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="mt-5 w-full rounded-2xl bg-green-500 py-4 text-[17px] font-black text-black shadow-[0_0_35px_rgba(34,197,94,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-400 active:scale-[0.98]"
            >
              Save Goals
            </button>
          </section>
        </div>
      </div>

      {showToast && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-3.5 font-bold text-black shadow-[0_0_40px_rgba(34,197,94,0.4)]">
            <CheckCircle2 className="h-5 w-5" />
            <span>Goals saved!</span>
          </div>
        </div>
      )}
    </main>
  );
}
