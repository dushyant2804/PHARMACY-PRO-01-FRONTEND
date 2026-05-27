```jsx
import React, {
  useEffect,
  useState,
} from "react";

export default function WelcomeScreen({
  onFinish,
}) {

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

      index++;

      setTypedText(
        fullText.slice(0, index)
      );

      if (index >= fullText.length) {

        clearInterval(typing);

        setTimeout(() => {

          setVisible(false);

          if (onFinish) {
            onFinish();
          }

        }, 700);
      }

    }, 16);

    return () => clearInterval(typing);

  }, []);

  if (!visible) return null;

  return (

    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black">

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-900" />

      {/* GLOW EFFECTS */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl -top-40 -left-40 animate-pulse" />

      <div className="absolute w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl bottom-0 right-0 animate-pulse" />

      {/* MAIN CONTENT */}
      <div className="relative h-full w-full px-8 py-10 md:px-16 md:py-16 flex flex-col justify-start items-start">

        {/* LOGO */}
        <div className="text-6xl md:text-7xl mb-8 animate-pulse">
          {logo}
        </div>

        {/* TITLE */}
<div
  className={
    "transition-all duration-300 will-change-transform text-white text-3xl md:text-6xl font-bold uppercase tracking-[0.12em] leading-tight max-w-5xl " +
    (effect === "glow"
      ? "drop-shadow-[0_0_20px_rgba(59,130,246,0.9)] "
      : "") +
    (effect === "terminal"
      ? "font-mono text-green-400"
      : "")
  }
>

  {typedText}

</div>

        {/* SUBTEXT */}
        <div className="mt-6 text-slate-500 tracking-[0.35em] uppercase text-xs md:text-sm">

          MedStock Pharmacy Operating System

        </div>

        {/* SYSTEM STATUS */}
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

        {/* SKIP BUTTON */}
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
```
