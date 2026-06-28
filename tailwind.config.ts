import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdfff",
          300: "#8ecbff",
          400: "#59adff",
          500: "#338cff",
          600: "#1c6ef5",
          700: "#1558e1",
          800: "#1848b6",
          900: "#1a418f",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "slide-down": "slideDown 0.3s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      boxShadow: {
        "soft": "0 4px 24px -6px rgba(0, 0, 0, 0.08)",
        "glow": "0 0 40px -10px rgba(28, 110, 245, 0.3)",
        "card-hover": "0 12px 40px -12px rgba(0, 0, 0, 0.12)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },
    },
  },
  plugins: [],
};

export default config;
