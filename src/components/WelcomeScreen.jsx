import React, {
  useEffect,
  useState,
} from "react";

const getStored = (key, fallback) =>
  localStorage.getItem(key) ?? fallback;

const getWelcomeSettings = (overrides = {}) => ({
  text: getStored("welcomeText", "WELCOME TO YOUR PHARMACY"),
  logo: getStored("welcomeLogo", "✚"),
  effect: getStored("welcomeEffect", "typing"),
  textColor: getStored("welcomeTextColor", "#ffffff"),
  textSize: getStored("welcomeTextSize", "48"),
  logoSize: getStored("welcomeLogoSize", "72"),
  backgroundColor: getStored("welcomeBgColor", "#020617"),
  backgroundImage: getStored("welcomeBgImage", ""),
  showLogo: getStored("welcomeShowLogo", "true") !== "false",
  showText: getStored("welcomeShowText", "true") !== "false",
  enabled: getStored("welcomeEnabled", "true") !== "false",
  ...overrides,
});

export default function WelcomeScreen({
  onFinish,
  preview = false,
  settings,
}) {
  const config = getWelcomeSettings(settings);
  const fullText = config.text;
  const effect = config.effect;

  const [typedText, setTypedText] = useState(
    effect === "typing" && !preview ? "" : fullText
  );

  const [visible, setVisible] =
    useState(true);

  useEffect(() => {
    if (!config.enabled) {
      setVisible(false);
      if (!preview && onFinish) onFinish();
      return undefined;
    }

    if (effect !== "typing" || !config.showText) {
      setTypedText(fullText);

      if (!preview) {
        const t = setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 1800);

        return () => clearTimeout(t);
      }

      return undefined;
    }

    let index = 0;

    setTypedText(preview ? fullText : "");

    if (preview) return undefined;

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
  }, [config.enabled, config.showText, effect, fullText, onFinish, preview]);

  if (!visible) return null;

  const rootClass = preview
    ? "relative overflow-hidden rounded-lg border min-h-[260px]"
    : "fixed inset-0 z-[9999] overflow-hidden";

  const textSize = Number(config.textSize || 48);
  const logoSize = Number(config.logoSize || 72);

  return (
    <div
      className={rootClass}
      style={{
        backgroundColor: config.backgroundColor,
        backgroundImage: config.backgroundImage
          ? `linear-gradient(rgba(2, 6, 23, 0.65), rgba(2, 6, 23, 0.75)), url(${config.backgroundImage})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-black/50 to-slate-900/80" />

      {/* GLOW EFFECTS */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl -top-40 -left-40 animate-pulse" />

      <div className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-3xl bottom-0 right-0 animate-pulse" />

      {/* MAIN CONTENT */}
      <div className={`${preview ? "min-h-[260px] p-8" : "h-full w-full px-8 py-10 md:px-16 md:py-16"} relative flex flex-col justify-start items-start`}>

        {/* LOGO */}
        {config.showLogo && (
          <img
            src="/pharmacyos-logo.svg"
            alt="PharmacyOS"
            className={`${effect === "pulse" ? "animate-pulse" : ""} mb-8 drop-shadow-2xl`}
            style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
          />
        )}

        {/* TITLE */}
        {config.showText && (
          <div
            className={
              `
              transition-all duration-300 will-change-transform
              font-bold
              uppercase
              tracking-[0.12em]
              leading-tight
              max-w-5xl
              ` +

              (effect === "glow"
                ? " drop-shadow-[0_0_20px_rgba(59,130,246,0.9)]"
                : "") +

              (effect === "terminal"
                ? " font-mono text-emerald-400"
                : "") +

              (effect === "fade"
                ? " animate-in fade-in duration-700"
                : "") +

              (effect === "slide"
                ? " animate-in slide-in-from-left-6 duration-700"
                : "")
            }
            style={{
              color: effect === "terminal" ? undefined : config.textColor,
              fontSize: preview ? `${Math.max(textSize * 0.55, 18)}px` : `${textSize}px`,
            }}
          >
            {typedText}
          </div>
        )}

        {/* SUBTEXT */}
        {!preview && (
          <>
            <div className="mt-6 text-slate-500 tracking-[0.35em] uppercase text-xs md:text-sm">
              PharmacyOS · Precision Pharmacy Operating System
            </div>

            {/* SYSTEM STATUS */}
            <div className="mt-10 space-y-2 text-slate-600 text-xs md:text-sm font-mono">
              <div>Initializing secure inventory...</div>
              <div>Connecting billing engine...</div>
              <div>Loading distributor database...</div>
              <div>Syncing pharmacy records...</div>
              <div className="text-emerald-400">System ready ✓</div>
            </div>
          </>
        )}

        {/* SKIP BUTTON */}
        {!preview && (
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
        )}
      </div>
    </div>
  );
}
