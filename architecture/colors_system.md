# Color Palette System

This document outlines the visual design system tokens used across the KIB Group Digital Ecosystem interface.

## Core Color Tokens

- **Accent Primary**: `#EA4335` (replacing previous orange/green styles with a solid, high-visibility red branding color).
- **Page Background**: `#FAFAFA`
- **Surface Background (Sidebar / Header)**: `#FBFBFB`
- **Border / Divider**: `#D9D9D9`
- **Text Primary**: `#171717`
- **Text Muted**: `#737373`

---

## Token Mapping Definition (`src/constants/colors.ts`)

```typescript
export const colors = {
  accent: {
    primary: '#EA4335',
    primaryHover: '#d3362a',
    primaryBg: 'rgba(234, 67, 53, 0.1)',
    primaryBorder: 'rgba(234, 67, 53, 0.25)',
  },
  neutral: {
    background: '#FAFAFA',
    card: '#FFFFFF',
    sidebar: '#FBFBFB',
    border: '#D9D9D9',
    text: '#171717',
    textMuted: '#737373',
    textSubtle: '#D4D4D4',
  }
};
```
