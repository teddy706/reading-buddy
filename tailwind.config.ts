import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "#FBF6EC",
        ink: "#2B2420",
        soft: "#8C8478",
        accent: "#D97757",
        a: { DEFAULT: "#5B8C7B", light: "#E4EFE9" },
        b: { DEFAULT: "#4C6EF5", light: "#E6EAFD" },
      },
      borderRadius: {
        card: "22px",
        btn: "16px",
      },
      boxShadow: {
        card: "0 3px 10px rgba(20,20,20,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
