import { createContext, useContext, useEffect, useState } from "react";

const FontContext = createContext();

export const FontProvider = ({ children }) => {
  const [font, setFont] = useState(
    localStorage.getItem("app-font") || '"IBM Plex Sans", sans-serif'
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font", font);
    localStorage.setItem("app-font", font);
  }, [font]);

  return (
    <FontContext.Provider value={{ font, setFont }}>
      {children}
    </FontContext.Provider>
  );
};

export const useFont = () => useContext(FontContext);
