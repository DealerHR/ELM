/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colours come from the signed-in organisation (src/lib/brand.ts sets the variables).
        'stratefix-yellow': 'rgb(var(--brand-primary) / <alpha-value>)',
        'stratefix-black': 'rgb(var(--brand-nav) / <alpha-value>)',
        'brand-primary': 'rgb(var(--brand-primary) / <alpha-value>)',
        'brand-on-primary': 'rgb(var(--brand-on-primary) / <alpha-value>)',
        'brand-nav': 'rgb(var(--brand-nav) / <alpha-value>)',
        'brand-accent': 'rgb(var(--brand-accent) / <alpha-value>)',
        // Greys are a step darker than Tailwind's so secondary text stays readable on laptops.
        gray: {
          50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
          400: '#8b93a1', 500: '#5f6877', 600: '#454d5b', 700: '#333a46', 800: '#1f2530', 900: '#111318',
        },
      },
    },
  },
  plugins: [],
};
