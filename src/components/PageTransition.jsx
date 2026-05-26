import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function PageTransition({ children }) {
  const location = useLocation();
  const [display, setDisplay] = useState(children);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setAnimating(true);

    const timeout1 = setTimeout(() => {
      setDisplay(children);
    }, 150);

    const timeout2 = setTimeout(() => {
      setAnimating(false);
    }, 350);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [location.pathname]);

  return (
    <div
      className={`transition-all duration-300 ${
        animating
          ? "opacity-0 scale-[0.98] blur-sm"
          : "opacity-100 scale-100 blur-0"
      }`}
      style={{ minHeight: "100vh" }}
    >
      {display}
    </div>
  );
}
