import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui_engine/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter-base)", "sans-serif"],
        serif: ["var(--font-lora-base)", "serif"],
      },
      colors: {
        border: {
          subtle: "rgb(226, 232, 240)", // slate-200
        },
        accent: {
          primary: "#14b8a6", // teal-500
        }
      }
    },
  },

  plugins: [],
} satisfies Config;
