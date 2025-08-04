module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#00C805",
          50: "#E9FBEA",
          100: "#D1F7D4",
          600: "#00B304",
          700: "#029A05"
        },
        bg: { base: "#FFFFFF", surface: "#FAFAFA", elevated: "#FFFFFF" },
        text: { primary: "#0F172A", secondary: "#334155", muted: "#64748B", inverse: "#FFFFFF" },
        stroke: { soft: "#E5E7EB", medium: "#CBD5E1", strong: "#94A3B8" },
        success: { 500: "#00C805" },
        warning: { 500: "#F59E0B" },
        danger: { 500: "#EF4444" }
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px", xl: "24px" },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,.06)",
        md: "0 8px 24px rgba(0,0,0,.08)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans"]
      }
    }
  },
  plugins: []
};
