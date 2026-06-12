/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cyan: 'var(--cyan)',
        sky: 'var(--sky)',
        'deep-blue': 'var(--deep-blue)',
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-sunken': 'var(--bg-sunken)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'coral-soft': 'var(--coral-soft)',
        amber: 'var(--amber)',
        danger: 'var(--danger)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '12px',
        md: '18px',
        lg: '24px',
        xl: '32px',
        full: '9999px',
      },
      boxShadow: {
        soft: '0 4px 16px rgba(31,102,153,0.08)',
        'soft-lg': '0 8px 28px rgba(31,102,153,0.12)',
        'soft-xl': '0 16px 44px rgba(31,102,153,0.16)',
        'cyan-glow': '0 8px 24px rgba(69,176,168,0.32)',
      },
      maxWidth: {
        phone: '390px',
      },
      transitionTimingFunction: {
        'spring-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
