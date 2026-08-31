/** @type {import('tailwindcss').Config} */
const gray = (prefix) => ({
  50: `rgb(var(--${prefix}-50) / <alpha-value>)`,
  100: `rgb(var(--${prefix}-100) / <alpha-value>)`,
  200: `rgb(var(--${prefix}-200) / <alpha-value>)`,
  300: `rgb(var(--${prefix}-300) / <alpha-value>)`,
  400: `rgb(var(--${prefix}-400) / <alpha-value>)`,
  500: `rgb(var(--${prefix}-500) / <alpha-value>)`,
  600: `rgb(var(--${prefix}-600) / <alpha-value>)`,
  700: `rgb(var(--${prefix}-700) / <alpha-value>)`,
  800: `rgb(var(--${prefix}-800) / <alpha-value>)`,
  900: `rgb(var(--${prefix}-900) / <alpha-value>)`,
  950: `rgb(var(--${prefix}-950) / <alpha-value>)`,
})

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#e0e4ea',
          300: '#c4cbd6',
          400: '#9aa5b4',
          500: '#687589',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
        },
        page: `rgb(var(--bg) / <alpha-value>)`,
        card: `rgb(var(--card) / <alpha-value>)`,
        surface: {
          50: `rgb(var(--surface-50) / <alpha-value>)`,
          100: `rgb(var(--surface-100) / <alpha-value>)`,
        },
        ink: gray('ink'),
        slate: gray('slate'),
        red: gray('slate'),
        orange: gray('slate'),
        amber: gray('slate'),
        yellow: gray('slate'),
        lime: gray('slate'),
        green: gray('slate'),
        emerald: gray('slate'),
        teal: gray('slate'),
        cyan: gray('slate'),
        sky: gray('slate'),
        blue: gray('slate'),
        indigo: gray('slate'),
        violet: gray('slate'),
        purple: gray('slate'),
        fuchsia: gray('slate'),
        pink: gray('slate'),
        rose: gray('slate'),
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lift: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}