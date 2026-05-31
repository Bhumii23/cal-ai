"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Flame, LogOut, Save, Target, Utensils, UserRound } from "lucide-react";

const USER_KEY = "calAi_user";
const FOOD_LOGS_KEY = "calAi_foodLogs";
const GOALS_KEY = "calAi_goals";
const PROFILE_KEY = "calAi_profile";

interface FoodLog {
  loggedAt?: string;
  createdAt?: string;
  date?: string;
}

interface User {
  name: string;
  email: string;
  password?: string;
  createdAt?: string;
}

interface Settings {
  name: string;
  email: string;
  age: string;
  weight: string;
  height: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const DEFAULT_SETTINGS: Settings = {
  name: "BH",
  email: "",
  age: "",
  weight: "",
  height: "",
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 60,
};

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
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? todayKey : getDateKey(date);
}

function parseLogs(rawLogs: string | null): FoodLog[] {
  if (!rawLogs) return [];
  try {
    const parsed: unknown = JSON.parse(rawLogs);
    if (Array.isArray(parsed)) return parsed.filter((log): log is FoodLog => typeof log === "object" && log !== null);
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed).flatMap(([date, logs]) =>
        Array.isArray(logs)
          ? logs.filter((log): log is FoodLog => typeof log === "object" && log !== null).map((log) => ({ ...log, date: log.date || date }))
          : []
      );
    }
  } catch (error) {
    console.error("Failed to parse food logs", error);
  }
  return [];
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BH";
}

function getStreak(logs: FoodLog[]) {
  const todayKey = getDateKey(new Date());
  const dates = new Set(logs.map((log) => getLogDateKey(log, todayKey)));
  let current = 0;
  let cursor = todayKey;
  while (dates.has(cursor)) {
    current += 1;
    cursor = getPreviousDateKey(cursor);
  }
  return { current, trackedDays: dates.size };
}

export default function ProfilePage() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [password, setPassword] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [stats, setStats] = useState({ meals: 0, trackedDays: 0, streak: 0 });
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const rawUser = localStorage.getItem(USER_KEY);
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    const rawGoals = localStorage.getItem(GOALS_KEY);
    const logs = parseLogs(localStorage.getItem(FOOD_LOGS_KEY));
    let user: User = { name: "BH", email: "" };
    let profile: Partial<Settings> = {};
    let goals: Partial<Settings> = {};

    try {
      if (rawUser) user = { ...user, ...(JSON.parse(rawUser) as User) };
      if (rawProfile) profile = JSON.parse(rawProfile) as Partial<Settings>;
      if (rawGoals) goals = JSON.parse(rawGoals) as Partial<Settings>;
    } catch (error) {
      console.error("Failed to parse saved profile", error);
    }

    const createdAt = user.createdAt || new Date().toISOString();
    if (rawUser && !user.createdAt) localStorage.setItem(USER_KEY, JSON.stringify({ ...user, createdAt }));
    setPassword(user.password || "");
    setMemberSince(new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    setSettings({
      ...DEFAULT_SETTINGS,
      ...profile,
      ...goals,
      name: user.name || DEFAULT_SETTINGS.name,
      email: user.email || "",
    });
    const streak = getStreak(logs);
    setStats({ meals: logs.length, trackedDays: streak.trackedDays, streak: streak.current });
  }, []);

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: ["calories", "protein", "carbs", "fat"].includes(key) ? Math.max(0, Number(value)) : value }));
  };

  const handleSave = () => {
    const rawUser = localStorage.getItem(USER_KEY);
    let createdAt = new Date().toISOString();
    try {
      if (rawUser) createdAt = (JSON.parse(rawUser) as User).createdAt || createdAt;
    } catch {}
    localStorage.setItem(USER_KEY, JSON.stringify({ name: settings.name.trim() || "BH", email: settings.email.trim().toLowerCase(), password, createdAt }));
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ age: settings.age, weight: settings.weight, height: settings.height }));
    localStorage.setItem(GOALS_KEY, JSON.stringify({ calories: settings.calories, protein: settings.protein, carbs: settings.carbs, fat: settings.fat }));
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2400);
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth");
  };

  return (
    <main className="app-shell min-h-screen pb-28 text-white selection:bg-green-500/30 md:pb-8 md:pl-64">
      <div className="page-enter min-h-screen">
        <header className="border-b border-white/10 bg-neutral-950/65 px-6 py-7 backdrop-blur-2xl md:px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-400">Account Settings</p>
          <h1 className="gradient-heading mt-2 text-3xl font-black">Your Profile</h1>
        </header>

        <div className="grid gap-6 p-6 md:grid-cols-[minmax(280px,34fr)_minmax(0,66fr)] md:gap-8 md:px-8">
          <section className="card-shimmer glass-card h-fit rounded-[28px] p-6 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-green-400/30 bg-green-500/15 text-3xl font-black text-green-200 shadow-[0_0_40px_rgba(34,197,94,0.22)]">{getInitials(settings.name)}</div>
            <h2 className="gradient-heading mt-5 text-2xl font-black">{settings.name || "BH"}</h2>
            <p className="mt-1 text-sm font-medium text-neutral-500">{settings.email || "No email added"}</p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Member since {memberSince || "Today"}</p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <Stat icon={Utensils} value={stats.meals} label="Meals" />
              <Stat icon={CalendarDays} value={stats.trackedDays} label="Days" />
              <Stat icon={Flame} value={stats.streak} label="Streak" accent />
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-6">
            <SettingsCard title="Personal Info" icon={UserRound}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={settings.name} onChange={(value) => updateSetting("name", value)} />
                <Input label="Email" type="email" value={settings.email} onChange={(value) => updateSetting("email", value)} />
                <Input label="Age" type="number" value={settings.age} onChange={(value) => updateSetting("age", value)} />
                <Input label="Weight" type="number" value={settings.weight} onChange={(value) => updateSetting("weight", value)} suffix="kg" />
                <Input label="Height" type="number" value={settings.height} onChange={(value) => updateSetting("height", value)} suffix="cm" />
              </div>
            </SettingsCard>

            <SettingsCard title="Nutrition Goals" icon={Target}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Daily calories" type="number" value={String(settings.calories)} onChange={(value) => updateSetting("calories", value)} suffix="kcal" />
                <Input label="Protein goal" type="number" value={String(settings.protein)} onChange={(value) => updateSetting("protein", value)} suffix="g" />
                <Input label="Carbs goal" type="number" value={String(settings.carbs)} onChange={(value) => updateSetting("carbs", value)} suffix="g" />
                <Input label="Fat goal" type="number" value={String(settings.fat)} onChange={(value) => updateSetting("fat", value)} suffix="g" />
              </div>
            </SettingsCard>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={handleSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-3.5 text-sm font-black text-black shadow-[0_0_30px_rgba(34,197,94,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-400 active:scale-[0.98]">
                <Save className="h-4 w-4" /> Save Changes
              </button>
              <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-3.5 text-sm font-black text-red-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-500/20 active:scale-[0.98]">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {showToast && (
        <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-3 text-sm font-black text-black shadow-[0_0_36px_rgba(34,197,94,0.35)]">
            <CheckCircle2 className="h-5 w-5" /> Profile saved
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ icon: Icon, value, label, accent = false }: { icon: typeof Flame; value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <Icon className={`mx-auto h-4 w-4 ${accent ? "fill-green-500 text-green-400" : "text-neutral-500"}`} />
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{label}</p>
    </div>
  );
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-[24px] p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-xl border border-green-500/20 bg-green-500/10 p-2.5"><Icon className="h-5 w-5 text-green-400" /></span>
        <h2 className="gradient-heading text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Input({ label, type = "text", value, onChange, suffix }: { label: string; type?: string; value: string; onChange: (value: string) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold text-neutral-400">{label}</span>
      <span className="flex items-center rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 focus-within:border-green-500/45">
        <input type={type} min={type === "number" ? "0" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none" />
        {suffix && <span className="text-xs font-bold text-neutral-600">{suffix}</span>}
      </span>
    </label>
  );
}
