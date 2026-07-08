/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6ff', 100: '#d9ecff', 200: '#bcdcff', 300: '#8ec5ff',
          400: '#59a5ff', 500: '#3182f6', 600: '#1c63e0', 700: '#174fb8',
          800: '#194296', 900: '#1a3a78',
        },
        accent: {
          400: '#22d3ac', 500: '#0fb894', 600: '#0a9678',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
        popup: '0 12px 40px rgba(15,23,42,0.18)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        fadeUp: 'fadeUp .4s ease-out both',
      },
    },
  },
  plugins: [],
}
