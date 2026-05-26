---
name: Obsidian Neon
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c5c5d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e8fa0'
  outline-variant: '#444654'
  surface-tint: '#bac3ff'
  primary: '#bac3ff'
  on-primary: '#00208d'
  primary-container: '#7087ff'
  on-primary-container: '#001b7d'
  inverse-primary: '#324fd8'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#c9c4d6'
  on-tertiary: '#312f3c'
  tertiary-container: '#928e9f'
  on-tertiary-container: '#2a2835'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dee1ff'
  primary-fixed-dim: '#bac3ff'
  on-primary-fixed: '#001159'
  on-primary-fixed-variant: '#0a33c0'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e5e0f2'
  tertiary-fixed-dim: '#c9c4d6'
  on-tertiary-fixed: '#1c1a27'
  on-tertiary-fixed-variant: '#484553'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 20px
  card-gap: 16px
---

## Brand & Style

The design system is built on a "Cyber-Travel" aesthetic, merging the utility of a travel companion with the sleek, high-tech visuals of a futuristic interface. It targets a modern, tech-savvy traveler who values both efficiency and a premium digital experience.

The style is **High-Contrast / Dark**, utilizing deep blacks and charcoals to make vibrant electric accents "pop" with maximum energy. It borrows elements from **Glassmorphism** for its container depth and **Modern SaaS** for its clean, functional information hierarchy. The interface feels immersive, technical, yet highly intuitive.

## Colors

The palette is strictly dark-mode first. The background uses **Obsidian** for true depth, while **Deep Charcoal** is reserved for surface cards and containers to create subtle separation.

**Electric Blue** is the "hero" color, used for primary action buttons, active navigation states, and interactive borders. A secondary **Emerald Green** provides a high-contrast alternative for success states and specific "Go" actions. A new **Midnight Violet** tertiary shade (#201E2B) is introduced for deep-layered elements and subtle background accents, providing a richer color depth to the interface. Neutral grays are used sparingly for secondary text to maintain the high-contrast drama of the interface.

## Typography

This design system relies on **Inter** to deliver a clean, utilitarian feel that scales perfectly from dense itinerary lists to bold headlines. 

Hierarchy is established through extreme weight contrast rather than size alone. Headlines are consistently heavy (700 Bold) to anchor the page, while body text remains breathable. Monospaced-style treatment (Inter with wider tracking) is used for time-stamps and technical metadata to reinforce the futuristic theme.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for narrow mobile viewports. It utilizes a standard 4px baseline grid to ensure all elements align harmoniously.

- **Margins:** A consistent 20px horizontal margin is applied to the main screen container.
- **Card-Based Architecture:** Information is grouped into cards with a 16px vertical gap between them.
- **Vertical Rhythm:** Generous whitespace (32px+) is used between major sections (e.g., between "Preferences" and "Primary Location") to prevent the dark interface from feeling cramped.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** and **Luminous Accents** rather than traditional drop shadows.

1.  **Level 0 (Base):** Obsidian (#0F0F0F) background.
2.  **Level 1 (Cards):** Deep Charcoal or Midnight Violet (#201E2B) with a very fine 1px semi-transparent border to define edges.
3.  **Level 2 (Interaction):** Elements like active selections or primary buttons use an "Electric Glow"—a soft, blue drop shadow with high spread and low opacity (e.g., `rgba(92, 119, 255, 0.3)`) to simulate light emission.
4.  **Backdrop Blurs:** Used for floating navigation bars and modals to maintain context of the content beneath.

## Shapes

The shape language is consistently **Rounded**, using an 8px (0.5rem) radius for standard cards and buttons. 

Secondary elements like tags, chips, and the floating navigation dock use **Pill-shaped** (fully rounded) corners to differentiate them from the structural containers. Selection indicators (checkboxes) use a smaller 4px radius to maintain a crisp, technical look.

## Components

### Buttons
- **Primary:** Electric Blue background with white or high-contrast text. In "hero" states, these feature a subtle gradient and a glow effect.
- **Secondary/Ghost:** Deep Charcoal background with a 1px Electric Blue or Gray border.
- **Destructive:** Dark base with Red (#EF4444) text and iconography.

### Navigation Bars
- **Floating Dock:** A bottom-anchored, pill-shaped container with a high backdrop blur, often utilizing the Midnight Violet tertiary shade for subtle background depth.
- **Active State:** The active icon is encased in a circular Electric Blue background that "breaks" the container's top edge slightly, creating a distinctive focal point.

### Cards & Lists
- **Status Cards:** Feature a left-aligned vertical timeline indicator.
- **Selection Cards:** When active, the entire border switches to Electric Blue (1-2px) to provide clear visual feedback.

### Form Elements
- **Inputs/Dropdowns:** Styled as Deep Charcoal containers with a chevron-right or chevron-down icon. Text is indented with 12px padding.
- **Switches:** Use Emerald Green for the "On" state to provide a clear functional distinction from the primary brand accents.

### Chat Bubbles
- **User:** Electric Blue background with white text, right-aligned.
- **Buddy (AI):** Deep Charcoal or Midnight Violet background with a 1px border, left-aligned, featuring the brand avatar.