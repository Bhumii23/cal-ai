import Link from "next/link";
import { Flame, Plus } from "lucide-react";

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  title?: string;
  subtitle?: string;
  titleClass?: string;
  subtitleClass?: string;
}

function ProgressRing({
  radius,
  stroke,
  progress,
  color,
  title,
  subtitle,
  titleClass = "text-3xl font-bold tracking-tighter",
  subtitleClass = "text-sm text-neutral-400 font-medium",
}: ProgressRingProps) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Clamp progress between 0 and 100 for visual purposes
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center drop-shadow-xl">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          stroke="rgba(255,255,255,0.06)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Fill */}
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        {title && <span className={titleClass}>{title}</span>}
        {subtitle && <span className={subtitleClass}>{subtitle}</span>}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-6 relative">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pt-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">Cal AI</h1>
            <p className="text-sm text-neutral-400 font-medium mt-0.5">Today</p>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-900/80 px-3 py-1.5 rounded-full border border-neutral-800 shadow-sm backdrop-blur-md">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-semibold text-orange-500">12</span>
          </div>
        </header>

        {/* Main Calorie Ring */}
        <section className="flex-1 flex flex-col items-center justify-center mb-10">
          <div className="relative p-6 bg-gradient-to-b from-neutral-900/40 to-black rounded-full shadow-[0_0_80px_rgba(34,197,94,0.08)] border border-neutral-800/30">
            <ProgressRing
              radius={140}
              stroke={14}
              progress={60}
              color="#22c55e"
              title="1200"
              subtitle="/ 2000 kcal"
            />
          </div>
          <p className="mt-8 text-neutral-500 font-medium tracking-widest text-xs uppercase">
            Remaining: <span className="text-white font-bold text-sm ml-1">800</span>
          </p>
        </section>

        {/* Macros */}
        <section className="grid grid-cols-3 gap-3 mb-12">
          {/* Protein */}
          <div className="flex flex-col items-center gap-3 p-4 bg-neutral-900/40 rounded-[28px] border border-neutral-800/40 backdrop-blur-md">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Protein</span>
            <ProgressRing
              radius={40}
              stroke={6}
              progress={75}
              color="#3b82f6"
              title="75%"
              titleClass="text-[13px] font-bold"
            />
            <span className="text-xs text-neutral-500 font-medium">90/120g</span>
          </div>

          {/* Carbs */}
          <div className="flex flex-col items-center gap-3 p-4 bg-neutral-900/40 rounded-[28px] border border-neutral-800/40 backdrop-blur-md">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Carbs</span>
            <ProgressRing
              radius={40}
              stroke={6}
              progress={45}
              color="#f59e0b"
              title="45%"
              titleClass="text-[13px] font-bold"
            />
            <span className="text-xs text-neutral-500 font-medium">112/250g</span>
          </div>

          {/* Fat */}
          <div className="flex flex-col items-center gap-3 p-4 bg-neutral-900/40 rounded-[28px] border border-neutral-800/40 backdrop-blur-md">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Fat</span>
            <ProgressRing
              radius={40}
              stroke={6}
              progress={90}
              color="#ef4444"
              title="90%"
              titleClass="text-[13px] font-bold"
            />
            <span className="text-xs text-neutral-500 font-medium">54/60g</span>
          </div>
        </section>

        {/* Action Button */}
        <div className="mt-auto pb-6">
          <Link
            href="/diary"
            className="group flex items-center justify-center gap-2 w-full bg-white text-black py-4.5 px-6 rounded-2xl font-bold text-[17px] hover:bg-neutral-200 transition-all active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            <Plus className="w-6 h-6 transition-transform group-hover:rotate-90 duration-300" />
            <span className="py-1">Log Food</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
