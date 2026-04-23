module.exports = {
  content: {
    relative: true,
    files: ["./index.html", "./src/**/*.{ts,tsx}"]
  },
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 60px rgba(2, 6, 23, 0.45)"
      }
    }
  },
  plugins: []
};
