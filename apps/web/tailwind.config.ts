import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#112A46",
        sky: "#E9F5FF",
        coral: "#FF6B4A",
        sand: "#FFF6E7",
        mint: "#CDEFE2",
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "sans-serif"],
        display: ["Trebuchet MS", "Arial Rounded MT Bold", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
