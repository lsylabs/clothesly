# Clothesly Design System

A fashion-forward, premium, and minimal design system for the Clothesly mobile app.

## Design Philosophy

### Core Principles

1. **Premium but Approachable** - High-end aesthetic without being intimidating
2. **Fashion-forward** - Bold typography and confident design choices
3. **Minimal with Personality** - Clean interfaces with intentional details
4. **Accessible** - WCAG compliant with high contrast and clear focus states

---

## Visual System

### Color Palette

An elegant monochrome system with subtle warmth:

```css
--background: #FAFAFA      /* Off-white background */
--foreground: #0A0A0A      /* Rich black text */
--primary: #0A0A0A         /* Primary actions */
--secondary: #F5F5F5       /* Secondary surfaces */
--muted: #E8E8E8          /* Subtle backgrounds */
--accent: #E0E0E0         /* Hover states */
```

**State Colors:**
- Destructive: `#DC2626` (Red)
- Success: `#059669` (Green)
- Warning: `#D97706` (Orange)

### Typography

Strong, intentional hierarchy with purposeful letter spacing:

**Scale:**
- 3XL (3rem) - Hero text
- 2XL (1.75rem) - Page titles (H1)
- XL (1.25rem) - Section headers (H2)
- LG (1.125rem) - Subsections (H3)
- Base (1rem) - Body text
- SM (0.875rem) - Labels, captions

**Weights:**
- Bold (700) - H1
- Semibold (600) - H2, H3
- Medium (500) - Buttons, labels
- Regular (400) - Body text

**Features:**
- Tight tracking (-0.02em) for large text
- Wide tracking (0.02em) for buttons and labels
- Uppercase labels with letter spacing
- Relaxed line-height (1.625) for body text

### Spacing System

Generous spacing for a premium feel:

```css
--space-xs: 0.25rem   /* 4px */
--space-sm: 0.5rem    /* 8px */
--space-md: 1rem      /* 16px */
--space-lg: 1.5rem    /* 24px */
--space-xl: 2rem      /* 32px */
--space-2xl: 3rem     /* 48px */
--space-3xl: 4rem     /* 64px */
```

### Border Radius

Refined, subtle curves throughout:

```css
--radius-sm: 0.375rem   /* Chips */
--radius-md: 0.5rem     /* Small elements */
--radius-lg: 0.75rem    /* Default */
--radius-xl: 1rem       /* Cards */
--radius-2xl: 1.5rem    /* Large cards */
```

### Shadows

Subtle depth for elevation:

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.03)
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.05)
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08)
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.12)
```

### Transitions

Smooth micro-interactions:

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```
