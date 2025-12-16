# Tailwind CSS v4 Patterns

## Class Organization
Order classes consistently:
1. Layout (display, position, grid/flex)
2. Spacing (margin, padding)
3. Sizing (width, height)
4. Typography (font, text)
5. Visual (bg, border, shadow)
6. Interactive (hover, focus, transition)

```tsx
<div className="flex items-center gap-4 p-4 w-full text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
```

## Responsive Design
- Mobile-first approach (base styles for mobile)
- Use breakpoints: sm:, md:, lg:, xl:, 2xl:
- Common pattern: stack on mobile, row on desktop

```tsx
<div className="flex flex-col md:flex-row gap-4">
```

## Dark Mode (This Project)
- Project uses dark theme by default
- Use gray-800/900 for backgrounds
- Use gray-100/200 for text on dark
- Use emerald-500/600 for accents

## RTL Support
- Use logical properties: ps-, pe-, ms-, me- (start/end)
- Avoid: pl-, pr-, ml-, mr- for horizontal spacing
- Use: text-start, text-end instead of text-left, text-right

```tsx
// Good - works RTL/LTR
<div className="ps-4 text-start">

// Avoid - breaks RTL
<div className="pl-4 text-left">
```

## Common Patterns

### Cards
```tsx
<div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
```

### Buttons
```tsx
// Primary
<button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">

// Secondary
<button className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors">
```

### Form Inputs
```tsx
<input className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
```

### Section Headers
```tsx
<h2 className="text-xl font-semibold text-white mb-4">
```

## Animation
- Use transition-colors for color changes
- Use transition-all sparingly (performance)
- Keep animations subtle: 150-300ms

## A4 Page Styling (Resume Templates)
```tsx
<div style={{
  width: '210mm',
  minHeight: '297mm',
  padding: '20mm',
}}>
```

## Avoid
- Arbitrary values when Tailwind has utility
- !important (use specificity instead)
- Inline styles (except for dynamic values like A4 dimensions)
- Deep nesting of responsive variants
