# CoffeeShop Frontend

React SPA for the CoffeeShop e-commerce platform. Japanese minimalist (Muji-inspired) design system built with Tailwind CSS v4.

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing | React Router 7 |
| Data fetching | TanStack Query v5 |
| State | Zustand 5 + persist |
| Forms | React Hook Form + Zod |
| Payments | Stripe.js |
| Animation | Framer Motion |
| Testing | Playwright (E2E) |
| Components | Storybook 8 |

## Getting Started

```bash
npm install
npm run dev        # development (localhost:5173)
npm run prod       # production mode
npm run build      # TypeScript check + Vite build
```

Requires the .NET API running at `localhost:5046`. See `../CoffeeShopApi/` or `../docker-compose.yml`.

## Project Structure

```
src/
├── api/           # Axios clients and endpoint functions
├── components/    # Shared UI components
├── design-system/ # Base design system components (Button, Input, etc.)
├── hooks/         # Custom React hooks
├── pages/         # Route-level page components
│   └── admin/     # Admin-only pages
├── router/        # React Router config
├── store/         # Zustand stores (auth, cart)
├── types/         # TypeScript types and interfaces
├── utils/         # Utility functions
└── index.css      # Tailwind v4 @theme tokens (design tokens live here)
```

## Path Aliases

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@ds/*` | `src/design-system/*` |
| `@components/*` | `src/components/*` |
| `@pages/*` | `src/pages/*` |
| `@hooks/*` | `src/hooks/*` |
| `@store/*` | `src/store/*` |
| `@api/*` | `src/api/*` |

## Design System

Design tokens are defined as CSS variables in the `@theme {}` block inside `src/index.css`. Components reference `var(--color-primary)` etc. directly. There is no `tailwind.config.ts`.

New components follow the `cva` + `cn()` pattern. See `src/design-system/Button` as the reference implementation.

## Storybook

```bash
npm run storybook          # dev server at localhost:6006
npm run build-storybook    # static build
```

## E2E Tests

```bash
npm run test:e2e           # headless
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:debug     # debug mode
npm run test:e2e:report    # show last report
```

## Key Notes

- Tailwind v4: uses `@theme {}` in CSS, not `tailwind.config.ts`
- Auth store persists to localStorage key `coffee_shop_auth`
- Cart store persists to localStorage key `coffee_shop_cart`
- JWT decode: `jwtDecode` named export from `jwt-decode` v4
- Backend enums arrive as strings (`JsonStringEnumConverter`)
- `tastingNotes` from API is a comma-separated string
- Deployed to Vercel; `vercel.json` rewrites all routes to `index.html`
