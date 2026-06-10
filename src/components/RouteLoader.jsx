import BrandLogo from "@/components/BrandLogo";
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
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
      
      <div className="text-center space-y-3">
        
        <div className="flex justify-center animate-pulse">
          <BrandLogo compact light />
        </div>

        <p className="text-sm text-emerald-100">
          Loading module...
        </p>

        {/* progress */}
        <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
