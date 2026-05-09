---
name: frontend-design-draft
description: Draft frontend design skill parked for future Watheq UI-skill replacement or explicit design-inspiration use. Use only when the user explicitly asks for frontend-design-draft, the parked frontend design skill, or to evaluate/replace the Watheq frontend UX skill with this broader frontend design guidance.
---

# Frontend Design Draft

This draft skill preserves a broader frontend-design direction for later review or replacement of `watheq-frontend-ux`. Treat it as inspiration unless the user explicitly asks to use it as the active frontend UX workflow.

Guide creation of distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a bold aesthetic direction:

- Purpose: What problem does this interface solve? Who uses it?
- Tone: Pick a specific aesthetic direction, such as brutally minimal, maximalist, retro-futuristic, organic, luxury, playful, editorial, brutalist, art deco, soft, industrial, or utilitarian. Use these for inspiration, but design one that is true to the product context.
- Constraints: Technical requirements, framework, performance, and accessibility.
- Differentiation: Identify the memorable design idea that makes the interface feel intentional.

Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism can both work when the direction is intentional.

Then implement working code that is:

- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point of view
- Refined in typography, spacing, motion, and interaction details

## Frontend Aesthetics Guidelines

Focus on:

- Typography: Choose fonts that support the product's tone. Avoid defaulting to generic choices unless they fit the interface.
- Color and theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents often work better than timid, evenly distributed palettes.
- Motion: Use animations for effects and micro-interactions. Prefer CSS-only solutions for plain HTML. Use the project's existing motion library for React when available. Prioritize a few high-impact moments over scattered motion.
- Spatial composition: Use deliberate layouts, asymmetry, overlap, diagonal flow, grid-breaking elements, generous negative space, or controlled density when they serve the product.
- Backgrounds and visual details: Create atmosphere and depth when useful. Use contextual effects and textures that match the overall aesthetic.

Avoid generic AI-generated aesthetics, including overused font choices, clichéd purple gradients on white backgrounds, predictable layouts, and cookie-cutter components that lack context-specific character.

Interpret creatively and make choices that feel designed for the actual product. Vary between light and dark themes, different type systems, and different visual languages when the context supports it.

Match implementation complexity to the aesthetic vision. Maximalist designs need more elaborate code and orchestration. Minimalist or refined designs need restraint, precision, spacing discipline, typography, and subtle interaction details.
