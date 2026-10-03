"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ArrowLeft, CalendarDays, Flame } from "lucide-react";
import { useRequireAuth } from "@/lib/auth";
import { loadFoodLogs, loadGoals } from "@/lib/db";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Filler);

const CALORIE_GOAL = 2000;

interface FoodLog {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  loggedAt?: string;
  createdAt?: string;
  date?: string;
}

interface DaySummary {
  key: string;
  dayName: string;
  dateLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isToday: boolean;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecentDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      key: getDateKey(date),
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      isToday: index === 6,
    };
  });
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function aggregateWeek(logs: FoodLog[]) {
  const days = getRecentDays();
  const todayKey = days[6].key;
  const daysByKey = new Map(days.map((day) => [day.key, day]));

  logs.forEach((log) => {
    const day = daysByKey.get(getLogDateKey(log, todayKey));

    if (!day) {
      return;
    }

    day.calories += toNumber(log.calories);
    day.protein += toNumber(log.protein);
    day.carbs += toNumber(log.carbs);
    day.fat += toNumber(log.fat);
  });

  return days;
}

function createGreenGradient(context: ScriptableContext<"bar">) {
  const { chart } = context;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "rgba(16, 185, 129, 0.82)";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, "rgba(5, 150, 105, 0.62)");
  gradient.addColorStop(0.48, "rgba(16, 185, 129, 0.92)");
  gradient.addColorStop(1, "rgba(110, 231, 183, 1)");
  return gradient;
}

export default function HistoryPage() {
  const { authLoading } = useRequireAuth();
  const [days, setDays] = useState<DaySummary[]>(() => getRecentDays());
  const [calorieGoal, setCalorieGoal] = useState(CALORIE_GOAL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const loadHistory = async () => {
      try {
        const [logs, goals] = await Promise.all([loadFoodLogs(), loadGoals()]);
        setDays(aggregateWeek(logs));
        if (Number.isFinite(goals.calories) && goals.calories > 0) {
          setCalorieGoal(goals.calories);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
    const onStorage = () => void loadHistory();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [authLoading]);

  const totalCalories = days.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = days.length > 0 ? Math.round(totalCalories / days.length) : 0;

  const chartData = useMemo(
    () => ({
      labels: days.map((day) => day.dayName),
      datasets: [
        {
          data: days.map((day) => day.calories),
          backgroundColor: createGreenGradient,
          borderColor: "rgba(110, 231, 183, 0.5)",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          barPercentage: 0.62,
          categoryPercentage: 0.82,
        },
      ],
    }),
    [days]
  );

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        displayColors: false,
        backgroundColor: "#171717",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        callbacks: {
          label: (context) => `${context.parsed.y ?? 0} kcal`,
        },
      },
    },
    scales: {
      x: {
        border: {
          display: false,
        },
        grid: {
          display: false,
        },
        ticks: {
          color: "#737373",
          font: {
            family: "inherit",
            size: 11,
            weight: 700,
          },
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: calorieGoal,
        border: {
          display: false,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.055)",
        },
        ticks: {
          color: "#525252",
          padding: 8,
          stepSize: 500,
          callback: (value) => `${Number(value) / 1000 || 0}k`,
          font: {
            family: "inherit",
            size: 10,
            weight: 600,
          },
        },
      },
    },
  };

  if (authLoading) {
    return (
      <main className="app-shell min-h-screen overflow-hidden pb-28 text-white md:pb-8 md:pl-64">
        <div className="p-6 md:px-8"><div className="skeleton h-48 rounded-[28px]" /></div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen overflow-hidden pb-28 text-white selection:bg-green-500/30 md:pb-8 md:pl-64">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.13),transparent_64%)]" />

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
            Weekly History
          </h1>
        </header>

        <div className="flex flex-col gap-8 p-6 md:px-8 md:py-6">
          <section className="glass-card history-fade-up relative overflow-hidden rounded-[30px] p-5">
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-green-500/10 blur-3xl" />

            <div className="relative mb-5 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-green-400">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Last 7 Days
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black tracking-tighter">
                    {totalCalories.toLocaleString()}
                  </span>
                  <span className="pb-1 text-xs font-bold text-neutral-500">
                    kcal total
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-green-500/15 bg-green-500/10 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-400/80">
                  Daily Avg
                </p>
                <p className="mt-0.5 text-sm font-black text-emerald-100">
                  {averageCalories.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="h-56">
              {isLoading ? <div className="skeleton h-full rounded-2xl" /> : <Bar data={chartData} options={chartOptions} />}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                Daily Breakdown
              </h2>
              <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-500">
                <Flame className="h-3.5 w-3.5 text-green-400" />
                {Math.round(calorieGoal).toLocaleString()} goal
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {days.map((day, index) => {
                const calorieProgress = Math.min(
                  (day.calories / Math.max(calorieGoal, 1)) * 100,
                  100
                );

                return (
                  <article
                    key={day.key}
                    className="glass-card history-fade-up group rounded-[24px] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-500/20"
                    style={{ animationDelay: `${120 + index * 55}ms` }}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-black/50 text-sm font-black text-neutral-200">
                          {day.dayName}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold tracking-tight">
                              {day.dateLabel}
                            </h3>
                            {day.isToday && (
                              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-green-400">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex gap-3 text-[10px] font-bold text-neutral-500">
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              {Math.round(day.protein)}g P
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              {Math.round(day.carbs)}g C
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              {Math.round(day.fat)}g F
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-black tracking-tight text-white">
                          {Math.round(day.calories).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                          kcal
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-600 via-green-500 to-green-300 transition-all duration-1000 ease-out"
                        style={{ width: `${calorieProgress}%` }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
