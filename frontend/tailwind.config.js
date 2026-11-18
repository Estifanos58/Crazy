/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        parlor: {
          bg: '#0F1412',
          surface: '#161D1A',
          elevated: '#1E2723',
          felt: '#153A2C',
          feltDark: '#0D261D',
          border: '#2A3631',
        },
        ivory: {
          50: '#FDFBF7',
          100: '#FAF6EE',
          200: '#ECE6DA',
          300: '#D2CABC',
          400: '#A6A095',
          500: '#78746B',
        },
        brass: {
          300: '#E8CC88',
          400: '#DBB763',
          500: '#C8A04A',
          600: '#A68032',
        },
        crimson: {
          400: '#E05A5A',
          500: '#C43434',
          600: '#9F2424',
        },
        jade: {
          400: '#4EA87E',
          500: '#2E865F',
          600: '#226A4A',
        },
      },
      boxShadow: {
        card: '0 4px 12px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)',
        'card-lifted': '0 14px 28px rgba(0, 0, 0, 0.48), 0 4px 10px rgba(0, 0, 0, 0.3)',
        surface: '0 12px 32px rgba(0, 0, 0, 0.32)',
      },
    },
  },
  plugins: [],
};
