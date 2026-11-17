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
          navy: '#0F172A',
          'navy-light': '#1E293B',
          'navy-dark': '#0A0F1D',
          ivory: '#F8FAFC',
          'ivory-card': '#FFFFFF',
          'ivory-muted': '#F1F5F9',
          sage: '#64748B',
          'sage-light': '#E2E8F0',
          'sage-dark': '#475569',
          teal: '#1E293B',
          'teal-light': '#334155',
          'teal-dark': '#0F172A',
          gold: '#475569',
          'gold-light': '#F1F5F9',
          'gold-dark': '#334155',
          text: '#0F172A',
          'text-secondary': '#64748B',
          'text-muted': '#94A3B8',
          border: '#E2E8F0',
          'border-dark': '#CBD5E1',
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
