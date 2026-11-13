/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF8',
        surface: {
          DEFAULT: '#FFFFFF',
          nested: '#F4F5F2',
          hover: '#EDEDEA',
        },
        primary: '#191B19',
        secondary: '#525651',
        muted: '#767A74',
        subtle: '#9B9F99',
        accent: {
          DEFAULT: '#237A57',
          hover: '#1B6447',
          active: '#155038',
          tint: '#EAF4EE',
          border: '#C8E3D5',
        },
        semantic: {
          success: '#2E7D32',
          successBg: '#EDF7ED',
          successBorder: '#C8E6C9',
          warning: '#B76E00',
          warningBg: '#FFF8E1',
          warningBorder: '#FFE082',
          error: '#C62828',
          errorBg: '#FDE8E8',
          errorBorder: '#F8B4B4',
          info: '#1565C0',
          infoBg: '#E3F2FD',
          infoBorder: '#BBDEFB',
        },
        border: {
          DEFAULT: '#E7E9E4',
          subtle: '#EFEFEA',
          strong: '#D4D7D0',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(25, 27, 25, 0.06), 0 1px 2px rgba(25, 27, 25, 0.04)',
        dropdown: '0 4px 12px rgba(25, 27, 25, 0.06), 0 1px 3px rgba(25, 27, 25, 0.04)',
        modal: '0 20px 48px -8px rgba(25, 27, 25, 0.18), 0 8px 16px -4px rgba(25, 27, 25, 0.08)',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        DEFAULT: '8px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}
