import { useEffect, useState } from "react";

export default function WelcomeScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 5000; // 5 seconds
    const intervalTime = 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (intervalTime / duration) * 100;
        if (next >= 100) {
          clearInterval(interval);
          onFinish();
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      
      {/* Soft glow circle */}
      <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />

      {/* Main content */}
      <div className="text-center space-y-3 z-10">
        <h1 className="text-4xl font-bold tracking-wide animate-fade-in">
          Welcome Back ✨
        </h1>

        <p className="text-slate-300 text-sm">
          Your workspace is ready…
        </p>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-blue-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-slate-400 mt-2">
          Loading experience...
        </p>
      </div>

      {/* Skip button */}
      <button
        onClick={onFinish}
        className="absolute bottom-6 right-6 text-xs text-slate-300 hover:text-white underline"
      >
        Skip
      </button>
    </div>
  );
}
