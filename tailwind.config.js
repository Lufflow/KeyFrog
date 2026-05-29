/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "rgb(var(--color-bg) / <alpha-value>)",
          panel: "rgb(var(--color-panel) / <alpha-value>)",
          border: "rgb(var(--color-border) / <alpha-value>)",
          ink: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-subtle) / <alpha-value>)",
          accent: "rgb(var(--color-accent) / <alpha-value>)",
          accentDark: "rgb(var(--color-accent-dark) / <alpha-value>)",
          danger: "rgb(var(--color-danger) / <alpha-value>)",
          dangerBg: "rgb(var(--color-danger-bg) / <alpha-value>)",
          warning: "rgb(var(--color-warning) / <alpha-value>)",
          warningBg: "rgb(var(--color-warning-bg) / <alpha-value>)"
        }
      },
      boxShadow: {
        surface: "var(--shadow-surface)"
      }
    }
  },
  plugins: [],
};
