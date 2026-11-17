/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clario: {
          navy: '#14263D',
          'navy-light': '#1E3553',
          'navy-dark': '#0E1B2C',
          ivory: '#F8F7F3',
          'ivory-card': '#FCFBF8',
          'ivory-muted': '#F0EFEA',
          sage: '#A9D5C3',
          'sage-light': '#D6ECE3',
          'sage-dark': '#78A895',
          teal: '#477E88',
          'teal-light': '#6EA5AF',
          'teal-dark': '#325C64',
          gold: '#D4AE72',
          'gold-light': '#F1DEC0',
          'gold-dark': '#A9844B',
          text: '#233448',
          'text-secondary': '#748293',
          'text-muted': '#96A3B2',
          border: '#E4E8E6',
          'border-dark': '#CCD3CF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(20, 38, 61, 0.05), 0 1px 2px rgba(20, 38, 61, 0.03)',
        'card': '0 4px 6px -1px rgba(20, 38, 61, 0.05), 0 2px 4px -1px rgba(20, 38, 61, 0.03)',
        'elevated': '0 10px 15px -3px rgba(20, 38, 61, 0.08), 0 4px 6px -2px rgba(20, 38, 61, 0.04)',
      },
      borderRadius: {
        'clario': '12px',
      }
    },
  },
  plugins: [],
}
