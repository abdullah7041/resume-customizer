# Tailwind CSS v4 Patterns

> **Project Design System:** Dark theme, glass morphism, emerald accents, RTL support

---

## Class Organization (Consistent Order)
```
1. Layout     → flex, grid, block, position
2. Spacing    → m-*, p-*, gap-*
3. Sizing     → w-*, h-*, min-*, max-*
4. Typography → font-*, text-*, leading-*
5. Visual     → bg-*, border-*, rounded-*, shadow-*
6. Effects    → opacity-*, blur-*, backdrop-*
7. Interactive→ hover:*, focus:*, transition-*
```

**Example:**
```tsx
<div className="flex items-center gap-4 p-4 w-full text-sm text-gray-100 bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg hover:bg-gray-700/50 transition-colors">
```

---

## Project Design Tokens

### Colors
```
Background:   bg-gray-900 (page), bg-gray-800 (cards), bg-gray-700 (inputs)
Text:         text-gray-100 (primary), text-gray-400 (secondary), text-gray-500 (muted)
Accent:       emerald-500 (primary), emerald-600 (hover), emerald-400 (light)
Border:       border-gray-700 (default), border-gray-600 (hover), border-emerald-500 (focus)
```

### Spacing Scale
```
Tight:   gap-2, p-2  (8px)
Default: gap-4, p-4  (16px)
Relaxed: gap-6, p-6  (24px)
Spacious:gap-8, p-8  (32px)
```

### Border Radius
```
Buttons: rounded-lg (8px)
Cards:   rounded-xl (12px) or rounded-2xl (16px)
Modals:  rounded-2xl (16px)
Pills:   rounded-full
```

---

## RTL Support (Critical for Arabic)

### ✅ USE Logical Properties
```tsx
// These flip automatically for RTL
<div className="ps-4">      {/* padding-start: left in LTR, right in RTL */}
<div className="pe-4">      {/* padding-end */}
<div className="ms-4">      {/* margin-start */}
<div className="me-4">      {/* margin-end */}
<div className="text-start"> {/* text-align: left/right based on direction */}
<div className="text-end">
<div className="start-0">   {/* replaces left-0 */}
<div className="end-0">     {/* replaces right-0 */}
```

### ❌ AVOID Physical Properties
```tsx
// These break RTL layout
<div className="pl-4">      {/* Always left, ignores RTL */}
<div className="pr-4">
<div className="ml-4">
<div className="mr-4">
<div className="text-left">
<div className="text-right">
<div className="left-0">
<div className="right-0">
```

### RTL-Aware Flex
```tsx
// Flex direction respects document direction
<div className="flex flex-row">  {/* Automatically RTL-aware */}

// Icons that need to flip
<ChevronRight className="rtl:rotate-180" />
```

---

## Component Patterns

### Glass Card (Project Standard)
```tsx
<div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 shadow-xl">
  {children}
</div>
```

### Primary Button
```tsx
<button className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
  {children}
</button>
```

### Secondary Button
```tsx
<button className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-gray-100 font-medium rounded-lg border border-gray-600 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors">
  {children}
</button>
```

### Ghost Button
```tsx
<button className="flex items-center justify-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
  {children}
</button>
```

### Form Input
```tsx
<input className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors" />
```

### Section Container
```tsx
<section className="py-12 md:py-20">
  <div className="container mx-auto px-4 max-w-6xl">
    {children}
  </div>
</section>
```

---

## Responsive Patterns

### Mobile-First Approach
```tsx
// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">

// Hide on mobile, show on desktop
<div className="hidden md:block">

// Full width on mobile, auto on desktop
<div className="w-full md:w-auto">

// Responsive text
<h1 className="text-2xl md:text-4xl lg:text-5xl">

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
```

### Breakpoints
```
sm:  640px   (large phones)
md:  768px   (tablets)
lg:  1024px  (laptops)
xl:  1280px  (desktops)
2xl: 1536px  (large screens)
```

---

## Animation Patterns

### Subtle Transitions (Preferred)
```tsx
// Color transitions
className="transition-colors duration-200"

// All properties (use sparingly)
className="transition-all duration-300"

// Transform transitions
className="transition-transform duration-200 hover:scale-105"
```

### Loading States
```tsx
// Pulse for skeleton loaders
className="animate-pulse bg-gray-700 rounded"

// Spin for spinners
className="animate-spin"
```

---

## A4 Resume Page (PDF Export)
```tsx
// Must use inline styles for exact A4 dimensions
<div 
  style={{
    width: '210mm',
    minHeight: '297mm',
    padding: '15mm 20mm',
    backgroundColor: 'white',
  }}
  className="text-gray-900 font-sans"
>
  {/* Resume content */}
</div>
```

---

## Avoid These

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| `!important` in utilities | Increase specificity or restructure |
| Arbitrary values `[123px]` | Use spacing scale or CSS variable |
| Deep nesting `md:hover:focus:` | Simplify state logic |
| `text-left`/`text-right` | `text-start`/`text-end` (RTL) |
| `ml-`/`mr-`/`pl-`/`pr-` | `ms-`/`me-`/`ps-`/`pe-` (RTL) |
| Inline styles for colors | Use Tailwind classes |