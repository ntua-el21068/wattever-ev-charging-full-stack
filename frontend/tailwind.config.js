import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}" // <--- SOS: Αυτό λέει στο Tailwind πού είναι τα κουμπιά
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui()] // <--- SOS: Αυτό ενεργοποιεί τα στυλ του HeroUI
}