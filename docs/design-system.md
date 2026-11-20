# SmartFlow AI Design System

## Visual Direction

SmartFlow AI uses a dark smart-city command-center style with navy surfaces and cyan blue accents. Green represents normal operation, yellow represents medium congestion, and red represents critical congestion.

## Themes

The application provides dark and light themes using CSS custom properties on `document.documentElement.dataset.theme`. Theme preference is stored locally in the browser.

## Core Tokens

- Background: `--bg`
- Primary surface: `--surface`
- Secondary surface: `--surface-2`
- Borders: `--border`
- Text: `--text`
- Muted text: `--muted`
- Primary accent: `--accent`
- Success: `--success`
- Warning: `--warning`
- Danger: `--danger`

## Components

Reusable components include buttons, cards, badges, page headers, loading skeletons, error states, and empty states. The app shell includes a collapsible desktop sidebar, responsive mobile drawer, top navigation, connection indicator, theme switcher, and profile control.

## Responsive Behavior

The layout uses desktop, tablet, and mobile breakpoints. The sidebar becomes a drawer on narrow screens, navigation labels collapse on desktop, and landing and placeholder content reflow into one column.
