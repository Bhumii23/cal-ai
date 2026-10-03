// Centralized auth for the Cal AI app.
//
// Dual-mode: Supabase-first, localStorage fallback.
// - No Supabase env vars  -> previous local demo behavior (hashed, multi-user).
// - With NEXT_PUBLIC_SUPABASE_URL + ANON_KEY -> real Supabase Auth (email +
//   Google OAuth, server-verified sessions). Food logs/goals move to Postgres
//   via src/lib/db.ts. Logout never wipes app data.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "./supabaseClient";

export const USERS_KEY = "calAi_users";
export const SESSION_KEY = "calAi_session";
const LEGACY_USER_KEY = "calAi_user";

export interface StoredUser {
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface PublicUser {
  name: string;
  email: string;
  createdAt: string;
}

interface Session {
  email: string;
  createdAt: string;
}

// 7 days
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isBrowser() {
  return typeof window !== "undefined";
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUsers(): StoredUser[] {
  if (!isBrowser()) return [];
  migrateLegacyUser();
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Per-user localStorage namespace so two accounts on the same browser
// never see each other's food logs / goals / profile extras.
export function scopedStorageKey(base: string, email: string) {
  return `${base}__${normalizeEmail(email)}`;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// One-time migration from the old single-user plaintext format:
// { name, email, password } -> hashed multi-user format.
// The plaintext password is hashed then the legacy entry is removed.
function migrateLegacyUser() {
  try {
    const raw = localStorage.getItem(LEGACY_USER_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as { name?: string; email?: string; password?: string; createdAt?: string };
    // Already migrated format (has passwordHash) - just drop legacy key.
    if (!legacy || typeof legacy !== "object" || !legacy.email || !legacy.password) {
      localStorage.removeItem(LEGACY_USER_KEY);
      return;
    }
    const existingRaw = localStorage.getItem(USERS_KEY);
    if (existingRaw) {
      localStorage.removeItem(LEGACY_USER_KEY);
      return;
    }
    // Defer: hashing is async, so mark for async migration.
    // The async part runs in ensureMigrated() below; here we only handle
    // the already-migrated / invalid cases synchronously.
    void (async () => {
      const users = readUsersSync();
      const email = normalizeEmail(legacy.email as string);
      if (users.some((u) => u.email === email)) {
        localStorage.removeItem(LEGACY_USER_KEY);
        return;
      }
      const salt = randomSalt();
      const passwordHash = await hashPassword(legacy.password as string, salt);
      users.push({
        name: (legacy.name || "User").trim() || "User",
        email,
        passwordHash,
        salt,
        createdAt: legacy.createdAt || new Date().toISOString(),
      });
      writeUsers(users);
      localStorage.removeItem(LEGACY_USER_KEY);
    })();
  } catch {
    try {
      localStorage.removeItem(LEGACY_USER_KEY);
    } catch {
      // ignore
    }
  }
}

function readUsersSync(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function signup(name: string, email: string, password: string): Promise<PublicUser> {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);
  if (!cleanName) throw new Error("Please enter your name.");
  if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  // Real backend path.
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: cleanName } },
      });
      if (error) throw new Error(error.message);
      const sbUser = data.user;
      // Ensure profile row exists (RLS: user manages own row).
      if (sbUser) {
        await supabase.from("profiles").upsert({ id: sbUser.id, name: cleanName });
        await supabase.from("goals").upsert({ user_id: sbUser.id });
      }
      return {
        name: cleanName,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
      };
    }
  }

  const users = readUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error("An account with this email already exists. Please log in.");
  }
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user: StoredUser = {
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  setSession(cleanEmail);
  return { name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");
  if (!password) throw new Error("Please enter your password.");

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw new Error(error.message);
      const sbUser = data.user;
      const metaName = (sbUser?.user_metadata as { name?: string } | undefined)?.name;
      // Keep a local display-name cache so sidebar/profile stay instant.
      if (sbUser) setSession(sbUser.email ?? cleanEmail);
      return {
        name: metaName || sbUser?.email?.split("@")[0] || "User",
        email: sbUser?.email ?? cleanEmail,
        createdAt: sbUser?.created_at ?? new Date().toISOString(),
      };
    }
  }

  const users = readUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (!user) throw new Error("No account found for this email. Please sign up first.");
  const attempt = await hashPassword(password, user.salt);
  if (attempt !== user.passwordHash) throw new Error("Incorrect email or password. Please try again.");
  setSession(cleanEmail);
  return { name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");

  // With Supabase, password resets go through email links (no plaintext reset).
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw new Error(error.message);
      throw new Error("Password reset link sent. Check your email, then log in.");
    }
  }

  if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");

  const users = readUsers();
  const index = users.findIndex((u) => u.email === cleanEmail);
  if (index === -1) throw new Error("No account found for this email.");
  const salt = randomSalt();
  users[index].salt = salt;
  users[index].passwordHash = await hashPassword(newPassword, salt);
  writeUsers(users);
  // Keep existing session state untouched; user must log in with the new password.
  // If they were logged in as this user, refresh the session timestamp.
  const session = getSessionEmail();
  if (session === cleanEmail) setSession(cleanEmail);
}

export async function signInWithGoogle(): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Google login needs Supabase keys. Add them to .env.local first.");
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
  if (error) throw new Error(error.message);
}

/** Supabase-first async current user. Falls back to local session. */
export async function getCurrentUserAsync(): Promise<PublicUser | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseBrowser();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        const sbUser = data.user;
        if (sbUser) {
          const metaName = (sbUser.user_metadata as { name?: string } | undefined)?.name;
          return {
            name: metaName || sbUser.email?.split("@")[0] || "User",
            email: sbUser.email ?? "",
            createdAt: sbUser.created_at ?? new Date().toISOString(),
          };
        }
      }
    } catch {
      // fall through to local
    }
  }
  return getCurrentUser();
}

function setSession(email: string) {
  const session: Session = { email: normalizeEmail(email), createdAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSessionEmail(): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session?.email) return null;
    const age = Date.now() - new Date(session.createdAt).getTime();
    if (Number.isNaN(age) || age > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return normalizeEmail(session.email);
  } catch {
    return null;
  }
}

export function getCurrentUser(): PublicUser | null {
  const email = getSessionEmail();
  if (!email) return null;
  const user = readUsers().find((u) => u.email === email);
  if (!user) return null;
  return { name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function updateCurrentUserProfile(input: { name: string; email: string }): Promise<PublicUser> {
  const cleanName = input.name.trim();
  const cleanEmail = normalizeEmail(input.email);
  if (!cleanName) throw new Error("Please enter your name.");
  if (!isValidEmail(cleanEmail)) throw new Error("Please enter a valid email address.");

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      const sbUser = data.user;
      if (!sbUser) throw new Error("You are not logged in.");
      if (cleanEmail !== sbUser.email) {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from("profiles").upsert({ id: sbUser.id, name: cleanName });
      if (error) throw new Error(error.message);
      setSession(cleanEmail);
      return { name: cleanName, email: cleanEmail, createdAt: sbUser.created_at ?? new Date().toISOString() };
    }
  }

  const sessionEmail = getSessionEmail();
  if (!sessionEmail) throw new Error("You are not logged in.");

  const users = readUsers();
  const index = users.findIndex((u) => u.email === sessionEmail);
  if (index === -1) throw new Error("Account not found. Please log in again.");
  if (cleanEmail !== sessionEmail && users.some((u) => u.email === cleanEmail)) {
    throw new Error("Another account already uses this email.");
  }
  users[index].name = cleanName;
  users[index].email = cleanEmail;
  writeUsers(users);
  // Move per-user data to the new email scope so logs/goals aren't lost.
  if (cleanEmail !== sessionEmail) {
    for (const base of ["calAi_foodLogs", "calAi_goals", "calAi_profile"]) {
      const oldKey = scopedStorageKey(base, sessionEmail);
      const newKey = scopedStorageKey(base, cleanEmail);
      try {
        if (localStorage.getItem(newKey) === null) {
          const existing = localStorage.getItem(oldKey);
          if (existing !== null) localStorage.setItem(newKey, existing);
        }
      } catch {
        // ignore storage errors
      }
    }
  }
  setSession(cleanEmail);
  return { name: users[index].name, email: users[index].email, createdAt: users[index].createdAt };
}

// Logout removes ONLY the session (Supabase + local). Food logs, goals and
// profile extras stay.
export async function logout() {
  if (isSupabaseConfigured()) {
    try {
      await getSupabaseBrowser()?.auth.signOut();
    } catch {
      // ignore, still clear local below
    }
  }
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
}

/** Client hook: redirects to /auth when there is no valid session.
 *  This is what makes login/signup the first page: every protected page
 *  (/, /diary, /history, /goals, /profile) calls this, so logged-out
 *  visitors are sent to /auth before any dashboard UI renders. */
export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Fast sync path for local demo mode: redirect instantly without
    // waiting for the async Supabase check, so logged-out users never
    // see a flash of the dashboard.
    if (!isSupabaseConfigured() && getSessionEmail() === null) {
      router.replace("/auth");
      return;
    }
    (async () => {
      const current = await getCurrentUserAsync();
      if (cancelled) return;
      if (!current) {
        router.replace("/auth");
        setAuthLoading(true);
        return;
      }
      setUser(current);
      setAuthLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { user, authLoading };
}
