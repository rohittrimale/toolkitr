import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'
import typographyPlugin from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      colors: {
        background:  'var(--ai-bg)',
        foreground:  'var(--ai-fg)',
        card: {
          DEFAULT:    'var(--ai-card)',
          foreground: 'var(--ai-card-fg)',
        },
        popover: {
          DEFAULT:    'var(--ai-popover)',
          foreground: 'var(--ai-popover-fg)',
        },
        primary: {
          DEFAULT:    'var(--ai-primary)',
          foreground: 'var(--ai-primary-fg)',
        },
        secondary: {
          DEFAULT:    'var(--ai-secondary)',
          foreground: 'var(--ai-secondary-fg)',
        },
        muted: {
          DEFAULT:    'var(--ai-muted)',
          foreground: 'var(--ai-muted-fg)',
        },
        accent: {
          DEFAULT:    'var(--ai-accent)',
          foreground: 'var(--ai-accent-fg)',
        },
        destructive: {
          DEFAULT:    'var(--ai-destructive)',
          foreground: 'var(--ai-destructive-fg)',
        },
        border: 'var(--ai-border)',
        input:  'var(--ai-input)',
        ring:   'var(--ai-ring)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animatePlugin, typographyPlugin],
}
export default config
