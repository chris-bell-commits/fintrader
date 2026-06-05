/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#ecad0a",
        primary: "#209dd7",
        secondary: "#753991",
        up: "#16c784",
        down: "#ea3943",
        terminal: {
          bg: "#0d1117",
          panel: "#161b22",
          raised: "#1c2230",
          border: "#2a3038",
          text: "#c9d1d9",
          muted: "#8b949e",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
