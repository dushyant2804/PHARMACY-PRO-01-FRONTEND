import { useEffect, useState } from "react";

export default function RouteLoader({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 2500; // 2.5 seconds
    const interval = 50;

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + (interval / duration) * 100;

        if (next >= 100) {
          clearInterval(timer);
          onDone();
          return 100;
        }

        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/80 backdrop-blur-md">
      
      <div className="text-center space-y-3">
        
        {/* animated pulse ring */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-blue-500 animate-ping opacity-30 absolute" />
          <div className="w-10 h-10 rounded-full bg-blue-600 animate-pulse" />
        </div>

        <p className="text-sm text-slate-600">
          Loading module...
        </p>

        {/* progress */}
        <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
