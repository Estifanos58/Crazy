/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#050511',
          dark: '#0a0a1f',
          primary: '#00f3ff', // Electric Cyan
          secondary: '#bc13fe', // Neon Purple
          accent: '#0aff0a', // Laser Green
          warning: '#ff0055', // Magenta/Red
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(to right, #00f3ff, #bc13fe)',
        'cyber-grid': 'linear-gradient(transparent 0%, #0a0a1f 100%), repeating-linear-gradient(0deg, transparent 0, transparent 49px, rgba(0, 243, 255, 0.1) 50px), repeating-linear-gradient(90deg, transparent 0, transparent 49px, rgba(0, 243, 255, 0.1) 50px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 243, 255, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 243, 255, 0.8), 0 0 10px rgba(188, 19, 254, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
    },
  },
  plugins: [],
}
