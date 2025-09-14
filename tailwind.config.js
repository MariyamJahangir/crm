/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cloud: {
          50: "#f6f7f8",
          100: "#eaecee",
          200: "#cfd3d7",
          300: "#b4bbc0",
          400: "#99a3aa",
          500: "#7f8a91", // base soft cloudy gray-blue
          600: "#667078",
          700: "#4d565d",
          800: "#343c42",
          900: "#1b2227",
        },
        stone: {
          50: "#f5f3f1",
          100: "#e9e4e1",
          200: "#d2c8c2",
          300: "#bbaa9f",
          400: "#a48e81",
          500: "#8c7468", // base warm brown/stone
          600: "#705b52",
          700: "#55443e",
          800: "#3a2e2a",
          900: "#1f1816",
        },
        sky: {
          50: "#f3f7f9",
          100: "#e1ecf2",
          200: "#bfd6e3",
          300: "#9bbfd3",
          400: "#77a9c4",
          500: "#5d8fab", // base muted blue
          600: "#4b7389",
          700: "#395866",
          800: "#273d44",
          900: "#152322",
        },
        ivory: {
          50: "#fbfaf9",
          100: "#f6f4f2",
          200: "#ece9e4",
          300: "#e1ded6",
          400: "#d6d2c8",
          500: "#cfc8bd", // base soft ivory white
          600: "#b3aca3",
          700: "#979088",
          800: "#7b746d",
          900: "#5f5952",
        },
        midnight: {
          50: "#f1f3f4",
          100: "#e0e5e7",
          200: "#b9c2c7",
          300: "#92a0a7",
          400: "#6c7e87",
          500: "#4b5c65", // base deep charcoal
          600: "#3c4a52",
          700: "#2d383e",
          800: "#1e262a",
          900: "#0f1315",
        },
      },
    },
  },
  plugins: [],
};
