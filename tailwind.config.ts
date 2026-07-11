import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)", steel: "var(--steel)", paper: "var(--paper)",
        panel: "var(--panel)", line: "var(--line)", accent: "var(--accent)",
        ok: "var(--ok)", warn: "var(--warn)", alarm: "var(--alarm)",
      },
    },
  },
  plugins: [],
};
export default config;
