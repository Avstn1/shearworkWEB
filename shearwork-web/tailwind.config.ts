/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        accent1: "var(--color-accent-1)",
        accent2: "var(--color-accent-2)",
        accent3: "var(--color-accent-3)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "Helvetica", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      }
    }
  },
  darkMode: "media", // Use system dark mode automatically
};
