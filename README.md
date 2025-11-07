# DeonPay Design System

A comprehensive design system for DeonPay applications, featuring design tokens, UI components, and interactive documentation.

## 🏗️ Monorepo Structure

```
deonpay-master/
├── packages/
│   ├── design-tokens/     # Design tokens (colors, spacing, shadows, etc.)
│   └── ui/               # React component library
├── apps/
│   ├── design-docs/      # Documentation site (brand.deonpay.mx)
│   ├── landing/          # Landing page (deonpay.mx)
│   └── dashboard/        # Dashboard app (dashboard.deonpay.mx)
└── README.md
```

## 📦 Packages

### @deonpay/design-tokens

Design tokens with support for light and dark themes.

**Features:**
- Color palette (primary, success, warning, danger, etc.)
- Spacing scale
- Border radius tokens
- Shadow tokens
- Typography tokens
- Auto-generated CSS custom properties

**Build tokens:**
```bash
cd packages/design-tokens
node build.js
```

**Output:**
- `dist/tokens.css` - CSS custom properties
- `dist/tokens.js` - JavaScript export
- `dist/tokens.d.ts` - TypeScript types

### @deonpay/ui

React component library built with Tailwind CSS and design tokens.

**Components:**
- `Button` - Primary, outline, ghost, danger variants
- `Card` - Container with header, title, content
- `Badge` - Status indicators (success, warning, danger, etc.)
- `StatusBadge` - Transaction status (completed, pending, canceled)
- `Switch` - Toggle switch
- `ThemeToggle` - Light/Dark mode toggle
- `StatCard` - KPI card with icon and trend

**Usage:**
```tsx
import { Button, Card, Badge, ThemeToggle } from '@deonpay/ui';

export default function MyComponent() {
  return (
    <Card>
      <h2>Welcome</h2>
      <Button variant="primary">Get Started</Button>
      <Badge variant="success">Active</Badge>
      <ThemeToggle />
    </Card>
  );
}
```

## 🚀 Apps

### Design Docs (brand.deonpay.mx)

Interactive documentation and component showcase.

**Features:**
- Live component examples
- Design token reference
- Color palette showcase
- Dark/Light theme support

**Development:**
```bash
cd apps/design-docs
npm install
npm run dev
```

**Build:**
```bash
npm run build
```

**Deploy:**
```bash
vercel --prod
```

### Landing (deonpay.mx)

Authentication landing page with signup/signin.

### Dashboard (dashboard.deonpay.mx)

Protected dashboard with merchant-based routing.

## 🎨 Design Tokens

### Colors

**Light Mode:**
- Primary: `#005FFF`
- Background: `#FFFFFF`
- Surface: `#F8F9FB`
- Text Primary: `#1B1B1F`
- Text Secondary: `#555B63`

**Dark Mode:**
- Primary: `#3B82F6`
- Background: `#0E0E0F`
- Surface: `#1C1C1E`
- Text Primary: `#FFFFFF`
- Text Secondary: `#A0A0A5`

### Typography

- Heading: `Poppins`
- Body: `Inter`
- Monospace: `ui-monospace, SFMono-Regular, Menlo`

### Border Radius

- `sm`: 0.5rem
- `md`: 0.75rem
- `lg`: 1rem
- `xl`: 1.5rem
- `2xl`: 2rem
- `full`: 9999px

### Shadows

- `sm`: 0 1px 2px rgba(0,0,0,0.05)
- `md`: 0 4px 10px rgba(0,0,0,0.1)
- `lg`: 0 8px 24px rgba(0,0,0,0.2)
- `xl`: 0 20px 40px rgba(0,0,0,0.3)

## 🌗 Dark Mode

The design system uses the `data-theme` attribute for theme switching.

**HTML:**
```html
<html data-theme="light">  <!-- or "dark" -->
```

**Toggle theme:**
```tsx
import { ThemeToggle } from '@deonpay/ui';

// In your component
<ThemeToggle />
```

**Manual toggle:**
```typescript
const toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const newTheme = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
};
```

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Install Dependencies

```bash
# Root
npm install

# Design Docs
cd apps/design-docs
npm install

# Landing
cd apps/landing
npm install

# Dashboard
cd apps/dashboard
npm install
```

### Build Design Tokens

```bash
cd packages/design-tokens
node build.js
```

### Run Development Server

```bash
# Design Docs
cd apps/design-docs
npm run dev  # http://localhost:3002

# Landing
cd apps/landing
npm run dev  # http://localhost:3000

# Dashboard
cd apps/dashboard
npm run dev  # http://localhost:3001
```

## 🏭 Production Build

### Build All Apps

```bash
# Design Docs
cd apps/design-docs
npm run build

# Landing
cd apps/landing
npm run build

# Dashboard
cd apps/dashboard
npm run build
```

## 🚢 Deployment

### Vercel Deployment

**Design Docs (brand.deonpay.mx):**
```bash
cd apps/design-docs
vercel --prod
```

**Configure custom domain in Vercel:**
1. Go to Vercel project settings
2. Add custom domain: `brand.deonpay.mx`
3. Update DNS with Vercel's CNAME

### Environment Variables

**Design Docs:** None required

**Landing & Dashboard:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_COOKIE_DOMAIN=.deonpay.mx`

## 📖 Using the Design System in New Projects

### 1. Install Dependencies

```bash
npm install react react-dom tailwindcss autoprefixer postcss lucide-react
```

### 2. Copy Design Tokens

Copy `packages/design-tokens` to your project or install as npm package.

### 3. Import Tokens CSS

In your `globals.css`:
```css
@import './path/to/design-tokens/dist/tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. Configure Tailwind

Update `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './path/to/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

### 5. Use Components

```tsx
import { Button, Card, Badge } from '@deonpay/ui';

export default function MyPage() {
  return (
    <div>
      <Card>
        <h1>Hello DeonPay</h1>
        <Button variant="primary">Click me</Button>
        <Badge variant="success">Active</Badge>
      </Card>
    </div>
  );
}
```

## 🎯 Component Examples

### Button

```tsx
<Button variant="primary" size="lg">Primary Button</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="ghost">Ghost Button</Button>
<Button variant="danger" disabled>Disabled</Button>
```

### Card

```tsx
<Card padding="lg">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here...</p>
  </CardContent>
</Card>
```

### Badge

```tsx
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Danger</Badge>

<StatusBadge status="completed" />
<StatusBadge status="pending" />
<StatusBadge status="canceled" />
```

### StatCard

```tsx
<StatCard
  title="Total Revenue"
  value="$45,231"
  icon={DollarSign}
  trend={{ value: 12.5, isPositive: true }}
  iconColor="var(--color-success)"
/>
```

## 🛠️ Troubleshooting

### CSS Not Loading

1. Verify `globals.css` imports tokens:
   ```css
   @import '../../packages/design-tokens/dist/tokens.css';
   ```

2. Check `tailwind.config.ts` includes UI package in content:
   ```typescript
   content: [
     './app/**/*.{js,ts,jsx,tsx,mdx}',
     '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
   ]
   ```

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run dev
   ```

### Dark Mode Not Working

1. Verify HTML has `data-theme` attribute:
   ```html
   <html data-theme="light">
   ```

2. Check localStorage for saved theme:
   ```javascript
   localStorage.getItem('theme')
   ```

3. Use `ThemeToggle` component or manual toggle function

## 📝 License

MIT

## 👥 Contributors

- DeonPay Team

---

**Generated with ❤️ by Claude Code**
