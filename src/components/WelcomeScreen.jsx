import React, {
  useEffect,
  useState,
} from "react";

export default function WelcomeScreen({
  onFinish,
}) {

  const [progress, setProgress] =
    useState(0);

  const [typedText, setTypedText] =
    useState("");

  const [visible, setVisible] =
    useState(true);

  const fullText =
    localStorage.getItem("welcomeText") ||
    "WELCOME TO YOUR PHARMACY";

  const logo =
    localStorage.getItem("welcomeLogo") ||
    "💊";

  const effect =
    localStorage.getItem("welcomeEffect") ||
    "typing";

  useEffect(() => {

    let index = 0;

    const typing = setInterval(() => {

      setTypedText(
        fullText.slice(0, index)
      );

      index++;

      if (index > fullText.length) {
        clearInterval(typing);
      }

    }, 25);

    return () => clearInterval(typing);

  }, [fullText]);

  useEffect(() => {

    const duration = 1400;

    const intervalTime = 80;

    const interval = setInterval(() => {

      setProgress((prev) => {

        const next =
          prev +
          (intervalTime / duration) * 100;

        if (next >= 100) {

          clearInterval(interval);

          setTimeout(() => {

            setVisible(false);

            if (onFinish) {
              onFinish();
            }

          }, 80);

          return 100;
        }

        return next;
      });

    }, intervalTime);

    return () => clearInterval(interval);

  }, [onFinish]);

  if (!visible) return null;

  return (

    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black">

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-900" />

      {/* GLOW */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl -top-40 -left-40 animate-pulse" />

      <div className="absolute w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl bottom-0 right-0 animate-pulse" />

      {/* CONTENT */}
      <div className="relative h-full w-full px-8 py-10 md:px-16 md:py-16 flex flex-col justify-start items-start">

        {/* LOGO */}
        <div className="text-6xl md:text-7xl mb-8 animate-pulse">
          {logo}
        </div>

        {/* TITLE */}
        <div
          className={`
            text-white
            text-3xl
            md:text-6xl
            font-bold
            uppercase
            tracking-[0.12em]
            leading-tight
            max-w-5xl

            ${
              effect === "glow"
                ? "drop-shadow-[0_0_20px_rgba(59,130,246,0.9)]"
                : ""
            }

            ${
              effect === "terminal"
                ? "font-mono text-green-400"
                : ""
            }
          `}
        >

          {typedText}

          <span className="animate-pulse">
            |
          </span>

        </div>

        {/* SUBTEXT */}
        <div className="mt-6 text-slate-500 tracking-[0.35em] uppercase text-xs md:text-sm">
          MedStock Pharmacy Operating System
        </div>

        {/* SYSTEM TEXT */}
        <div className="mt-10 space-y-2 text-slate-600 text-xs md:text-sm font-mono">

          <div>
            Initializing secure inventory...
          </div>

          <div>
            Connecting billing engine...
          </div>

          <div>
            Loading distributor database...
          </div>

          <div>
            Syncing pharmacy records...
          </div>

          <div className="text-green-400">
            System ready ✓
          </div>

        </div>

        {/* PROGRESS BAR */}
        <div className="mt-10 w-full max-w-md">

          <div className="h-1 bg-white/10 rounded-full overflow-hidden">

            <div
              className="h-full bg-blue-400 transition-all duration-150"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

          <div className="flex justify-between text-[10px] text-slate-500 mt-2 tracking-widest uppercase">

            <span>
              Loading
            </span>

            <span>
              {Math.floor(progress)}%
            </span>

          </div>

        </div>

        {/* SKIP */}
        <button
          onClick={() => {

            setVisible(false);

            if (onFinish) {
              onFinish();
            }

          }}
          className="absolute bottom-6 right-6 text-xs text-slate-400 hover:text-white transition-all underline"
        >
          Skip Intro
        </button>

      </div>

    </div>
  );
}
