import { createContext, useContext } from "react";

export const LayoutContext = createContext({
  inspectorMode: false,
  setInspectorMode: () => {},
});

export const useLayout = () => useContext(LayoutContext);
