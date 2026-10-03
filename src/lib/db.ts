// Data layer: Supabase-first, localStorage fallback.
// Works today with zero config (localStorage). Once you add
// NEXT_PUBLIC_SUPABASE_URL + ANON_KEY and run supabase/schema.sql,
// the same calls transparently use Postgres for logged-in users.

"use client";

import { getSupabaseBrowser, isSupabaseConfigured } from "./supabaseClient";
import { getSessionEmail, scopedStorageKey } from "./auth";

export const FOOD_LOGS_KEY = "calAi_foodLogs";
export const GOALS_KEY = "calAi_goals";
export const PROFILE_KEY = "calAi_profile";

export interface FoodLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string;
  loggedAt: string;
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_GOALS: Goals = { calories: 2000, protein: 120, carbs: 250, fat: 60 };

async function supabaseUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowser();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Per-user key for local demo mode. Falls back to the unscoped key when
// logged out, or to legacy unscoped data on first run after this fix.
function localKey(base: string): string {
  try {
    const email = getSessionEmail();
    if (email) return scopedStorageKey(base, email);
  } catch {
    // ignore, use base key
  }
  return base;
}

function readLocalScoped<T>(base: string, fallback: T): T {
  const scoped = readLocal<T>(localKey(base), fallback as T);
  // One-time fallback: data saved before per-user scoping lives under
  // the bare key. Use it when the scoped key is still empty.
  if (base === FOOD_LOGS_KEY || base === GOALS_KEY || base === PROFILE_KEY) {
    const isEmpty =
      scoped == null ||
      (Array.isArray(scoped) && scoped.length === 0) ||
      (typeof scoped === "object" && !Array.isArray(scoped) && Object.keys(scoped as object).length === 0);
    if (isEmpty) {
      const legacy = readLocal<T>(base, fallback as T);
      const legacyEmpty =
        legacy == null ||
        (Array.isArray(legacy) && legacy.length === 0) ||
        (typeof legacy === "object" && !Array.isArray(legacy) && Object.keys(legacy as object).length === 0);
      if (!legacyEmpty) return legacy;
    }
  }
  return scoped;
}

export interface ProfileExtras {
  age: string;
  weight: string;
  height: string;
}

export function loadProfileExtras(): ProfileExtras {
  const data = readLocalScoped<Partial<ProfileExtras>>(PROFILE_KEY, {});
  return {
    age: typeof data.age === "string" ? data.age : "",
    weight: typeof data.weight === "string" ? data.weight : "",
    height: typeof data.height === "string" ? data.height : "",
  };
}

export function saveProfileExtras(extras: ProfileExtras): void {
  try {
    localStorage.setItem(localKey(PROFILE_KEY), JSON.stringify(extras));
  } catch {
    // ignore storage errors
  }
}

// ---------- Food logs ----------

export async function loadFoodLogs(): Promise<FoodLog[]> {
  const userId = await supabaseUserId();
  if (userId) {
    const supabase = getSupabaseBrowser();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("food_logs")
      .select("id,name,calories,protein,carbs,fat,serving_size,logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("Supabase loadFoodLogs failed, falling back to local", error);
    } else {
      return (data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Logged meal"),
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        carbs: Number(row.carbs) || 0,
        fat: Number(row.fat) || 0,
        servingSize: (row.serving_size as string) || "Unknown",
        loggedAt: String(row.logged_at),
      }));
    }
  }
  // Local fallback: tolerate both array and {date: []} shapes + legacy fields.
  const parsed: unknown = readLocalScoped<unknown>(FOOD_LOGS_KEY, []);
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null
      ? Object.entries(parsed).flatMap(([date, logs]) =>
          Array.isArray(logs) ? logs.map((l) => ({ ...(l as object), date })) : []
        )
      : [];
  return list
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l, i) => ({
      id: String(l.id ?? `${l.name ?? "meal"}-${i}`),
      name: String(l.name ?? "Logged meal"),
      calories: Number(l.calories) || 0,
      protein: Number(l.protein) || 0,
      carbs: Number(l.carbs) || 0,
      fat: Number(l.fat) || 0,
      servingSize: String(l.servingSize ?? "Unknown"),
      loggedAt: String(l.loggedAt ?? l.createdAt ?? l.date ?? new Date().toISOString()),
    }));
}

export async function addFoodLog(input: Omit<FoodLog, "id" | "loggedAt"> & { loggedAt?: string }): Promise<FoodLog> {
  const userId = await supabaseUserId();
  if (userId) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data, error } = await supabase
        .from("food_logs")
        .insert({
          user_id: userId,
          name: input.name,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          serving_size: input.servingSize ?? "Unknown",
          logged_at: input.loggedAt ?? new Date().toISOString(),
        })
        .select("id,name,calories,protein,carbs,fat,serving_size,logged_at")
        .single();
      if (!error && data) {
        return {
          id: String(data.id),
          name: String(data.name),
          calories: Number(data.calories) || 0,
          protein: Number(data.protein) || 0,
          carbs: Number(data.carbs) || 0,
          fat: Number(data.fat) || 0,
          servingSize: String(data.serving_size ?? "Unknown"),
          loggedAt: String(data.logged_at),
        };
      }
      console.error("Supabase addFoodLog failed, falling back to local", error);
    }
  }
  const entry: FoodLog = {
    ...input,
    id: crypto.randomUUID(),
    loggedAt: input.loggedAt ?? new Date().toISOString(),
  };
  const current = await loadFoodLogsLocalOnly();
  try {
    localStorage.setItem(localKey(FOOD_LOGS_KEY), JSON.stringify([entry, ...current]));
  } catch {
    // ignore storage errors
  }
  return entry;
}

async function loadFoodLogsLocalOnly(): Promise<FoodLog[]> {
  // Local-only read without Supabase round-trip (used by add fallback).
  // Reuses the same tolerant parsing as loadFoodLogs so legacy shapes
  // are never wiped by an add.
  const parsed: unknown = readLocalScoped<unknown>(FOOD_LOGS_KEY, []);
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null
      ? Object.entries(parsed).flatMap(([date, logs]) =>
          Array.isArray(logs) ? logs.map((l) => ({ ...(l as object), date })) : []
        )
      : [];
  return list
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l, i) => ({
      id: String(l.id ?? `${l.name ?? "meal"}-${i}`),
      name: String(l.name ?? "Logged meal"),
      calories: Number(l.calories) || 0,
      protein: Number(l.protein) || 0,
      carbs: Number(l.carbs) || 0,
      fat: Number(l.fat) || 0,
      servingSize: String(l.servingSize ?? "Unknown"),
      loggedAt: String(l.loggedAt ?? l.createdAt ?? l.date ?? new Date().toISOString()),
    }));
}

export async function deleteFoodLog(id: string): Promise<void> {
  const userId = await supabaseUserId();
  if (userId) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", userId);
      if (!error) return;
      console.error("Supabase deleteFoodLog failed, falling back to local", error);
    }
  }
  const current = readLocalScoped<FoodLog[]>(FOOD_LOGS_KEY, []);
  const kept = (Array.isArray(current) ? current : []).filter((l) => l.id !== id);
  try {
    localStorage.setItem(localKey(FOOD_LOGS_KEY), JSON.stringify(kept));
  } catch {
    // ignore storage errors
  }
}

// ---------- Goals ----------

export async function loadGoals(): Promise<Goals> {
  const userId = await supabaseUserId();
  if (userId) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data, error } = await supabase
        .from("goals")
        .select("calories,protein,carbs,fat")
        .eq("user_id", userId)
        .single();
      if (!error && data) {
        return {
          calories: Number(data.calories) || DEFAULT_GOALS.calories,
          protein: Number(data.protein) || DEFAULT_GOALS.protein,
          carbs: Number(data.carbs) || DEFAULT_GOALS.carbs,
          fat: Number(data.fat) || DEFAULT_GOALS.fat,
        };
      }
      // No row yet -> fall through to local/default (will upsert on save).
    }
  }
  const local = readLocalScoped<Partial<Goals>>(GOALS_KEY, {});
  return {
    calories: Number(local.calories) || DEFAULT_GOALS.calories,
    protein: Number(local.protein) || DEFAULT_GOALS.protein,
    carbs: Number(local.carbs) || DEFAULT_GOALS.carbs,
    fat: Number(local.fat) || DEFAULT_GOALS.fat,
  };
}

export async function saveGoals(goals: Goals): Promise<void> {
  try {
    localStorage.setItem(localKey(GOALS_KEY), JSON.stringify(goals)); // always keep local copy
  } catch {
    // ignore storage errors
  }
  const userId = await supabaseUserId();
  if (!userId) return;
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("goals").upsert({ user_id: userId, ...goals, updated_at: new Date().toISOString() });
  if (error) console.error("Supabase saveGoals failed (local copy kept)", error);
}
