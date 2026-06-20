export const fonts = {
  ibmPlex: {
    name: "IBM Plex Sans",
    value: '"IBM Plex Sans", sans-serif',
  },
  inter: {
    name: "Inter",
    value: '"Inter", sans-serif',
  },
  roboto: {
    name: "Roboto",
    value: '"Roboto", sans-serif',
  },
  openSans: {
    name: "Open Sans",
    value: '"Open Sans", sans-serif',
  },
  montserrat: {
    name: "Montserrat",
    value: '"Montserrat", sans-serif',
  },
  sourceSans3: {
    name: "Source Sans 3",
    value: '"Source Sans 3", sans-serif',
  },
  workSans: {
    name: "Work Sans",
    value: '"Work Sans", sans-serif',
  },
  lato: {
    name: "Lato",
    value: '"Lato", sans-serif',
  },
  merriweather: {
    name: "Merriweather",
    value: '"Merriweather", serif',
  },
  cabin: {
    name: "Cabin",
    value: '"Cabin", sans-serif',
  },
  ubuntu: {
    name: "Ubuntu",
    value: '"Ubuntu", sans-serif',
  },
  ptSans: {
    name: "PT Sans",
    value: '"PT Sans", sans-serif',
  },
  poppins: {
    name: "Poppins",
    value: '"Poppins", sans-serif',
  },
  raleway: {
    name: "Raleway",
    value: '"Raleway", sans-serif',
  },
  playfair: {
    name: "Playfair Display",
    value: '"Playfair Display", serif',
  },
  cormorant: {
    name: "Cormorant Garamond",
    value: '"Cormorant Garamond", serif',
  },
  nunito: {
    name: "Nunito",
    value: '"Nunito", sans-serif',
  },
  josefinSans: {
    name: "Josefin Sans",
    value: '"Josefin Sans", sans-serif',
  },
  calligraphy: {
    name: "Great Vibes (Legacy Accent)",
    value: '"Great Vibes", cursive',
  },
};

export const fontGroups = {
  Professional: ["ibmPlex", "inter", "roboto", "openSans", "montserrat", "sourceSans3", "workSans"],
  Classy: ["lato", "merriweather", "cabin", "ubuntu", "ptSans"],
  Elegant: ["poppins", "raleway", "playfair", "cormorant"],
  Experimental: ["nunito", "josefinSans"],
  Legacy: ["calligraphy"],
};

export const getFontName = (value) =>
  Object.values(fonts).find((item) => item.value === value)?.name || value || "IBM Plex Sans";
