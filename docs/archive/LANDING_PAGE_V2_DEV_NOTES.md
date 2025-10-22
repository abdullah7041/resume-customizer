# Landing Page V2 - Developer Implementation Notes

## 🎯 Quick Start

### View the New Landing Page

1. **Clear localStorage** (to reset "landingSeen" flag):
```js
localStorage.removeItem('airo:landingSeen');
location.reload();
```

2. **Toggle between versions** in `MainContent.jsx`:
```jsx
// Line ~126
const [useV2Landing, setUseV2Landing] = useState(true);  // V2 (new)
const [useV2Landing, setUseV2Landing] = useState(false); // V1 (original)
```

3. **Server running at**: http://localhost:5174

---

## 🏗️ Component Architecture

### File Structure
```
src/components/
├─ LandingPage.jsx          (V1 - Original)
├─ LandingPageV2.jsx        (V2 - New, 800+ lines) ← NEW FILE
└─ MainContent.jsx          (Updated with toggle)
```

### Component Hierarchy

```jsx
<LandingPageV2 onGetStarted={callback}>
  ├─ <HeroSection scrollProgress={scrollYProgress}>
  │    ├─ Parallax background layers (motion.div with y transform)
  │    ├─ <FloatingElement /> × 4 (FileText, Target, Sparkles, Zap)
  │    ├─ Headline with staggered word animation
  │    ├─ Magnetic CTA button (with useRef + mousemove listener)
  │    └─ Scroll indicator (bounce animation)
  │
  ├─ <InteractiveStats>
  │    └─ <StatCard /> × 4 (Users, TrendingUp, Award, Clock)
  │         └─ Counter animation with useInView trigger
  │
  ├─ <FeaturesShowcase>
  │    └─ <FeatureCard /> × 6 (FileText, Target, Sparkles, etc.)
  │         └─ 3D tilt on hover (rotateX/Y state + mousemove)
  │
  ├─ <VisualDemo>
  │    ├─ Animated process steps (Upload → Analyze → Transform)
  │    └─ Before/After comparison cards
  │
  ├─ <SocialProof>
  │    └─ <TestimonialCard /> (infinite horizontal scroll)
  │
  └─ <FinalCTA>
       └─ Magnetic button with gradient mesh background
```

---

## 🎨 Framer Motion Patterns Used

### 1. Scroll-Linked Parallax
```jsx
import { useScroll, useTransform } from "framer-motion";

const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ["start start", "end end"]
});

const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
const y3 = useTransform(scrollYProgress, [0, 1], ['0%', '70%']);

<motion.div style={{ y: y1 }}>Layer 1 (slowest)</motion.div>
<motion.div style={{ y: y2 }}>Layer 2 (medium)</motion.div>
<motion.div style={{ y: y3 }}>Layer 3 (fastest)</motion.div>
```

**Performance**: Uses native `transform: translateY()` (GPU-accelerated)  
**Effect**: Creates depth—background moves slower than foreground

---

### 2. Mouse-Tracked Parallax
```jsx
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

useEffect(() => {
  const handleMouseMove = (e) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setMousePosition({
      x: (e.clientX - centerX) / 50,  // Damping factor
      y: (e.clientY - centerY) / 50,
    });
  };
  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, []);

<motion.div
  animate={{ 
    x: mousePosition.x * parallaxFactor,
    y: mousePosition.y * parallaxFactor 
  }}
  transition={{ type: "spring", stiffness: 50, damping: 20 }}
>
  <Icon />
</motion.div>
```

**Key Parameters**:
- **Damping**: 50 = responsive, not jittery (cursor offset / 50)
- **Spring Stiffness**: 50 = smooth, organic movement
- **Spring Damping**: 20 = minimal bounce

**Mobile Optimization**:
```jsx
const isMobile = window.innerWidth < 768;
if (isMobile) return null; // Skip parallax on mobile
```

---

### 3. Magnetic Button Effect
```jsx
const buttonRef = useRef(null);
const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });

const handleMouseMove = (e) => {
  if (!buttonRef.current) return;
  
  const rect = buttonRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  const distance = Math.sqrt(x * x + y * y);
  
  if (distance < 150) {  // Activation radius
    setButtonOffset({ x: x * 0.25, y: y * 0.25 });  // Pull strength
  } else {
    setButtonOffset({ x: 0, y: 0 });
  }
};

<section onMouseMove={handleMouseMove}>
  <motion.div
    ref={buttonRef}
    animate={{ x: buttonOffset.x, y: buttonOffset.y }}
    transition={{ type: "spring", stiffness: 150, damping: 15 }}
  >
    <Button>Get Started</Button>
  </motion.div>
</section>
```

**Tuning Guide**:
- **Activation Radius**: 150px = noticeable but not aggressive
- **Pull Strength**: 0.25 = subtle magnet (increase to 0.4 for stronger pull)
- **Stiffness**: 150 = quick response (decrease to 100 for slower follow)
- **Damping**: 15 = slight bounce (increase to 30 for no bounce)

---

### 4. 3D Card Tilt
```jsx
const [rotateX, setRotateX] = useState(0);
const [rotateY, setRotateY] = useState(0);
const [isHovered, setIsHovered] = useState(false);

const handleMouseMove = (e) => {
  if (!isHovered) return;
  
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  setRotateY((x - centerX) / 10);   // Horizontal tilt
  setRotateX((centerY - y) / 10);   // Vertical tilt (inverted)
};

<motion.div
  style={{ perspective: "1000px" }}
  onMouseMove={handleMouseMove}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => { setIsHovered(false); setRotateX(0); setRotateY(0); }}
>
  <motion.div
    animate={{ rotateX, rotateY }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    style={{ transformStyle: "preserve-3d" }}
  >
    <div style={{ transform: "translateZ(50px)" }}>
      {/* Content appears "lifted" */}
    </div>
  </motion.div>
</motion.div>
```

**3D Effect Breakdown**:
- **Perspective**: 1000px = moderate depth (500px = extreme, 2000px = subtle)
- **Tilt Divisor**: 10 = smooth rotation (5 = aggressive, 20 = minimal)
- **TranslateZ**: 50px = content "lifts" out of card on hover

---

### 5. Scroll-Triggered Counter
```jsx
import { useInView } from "framer-motion";

const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: "-100px" });
const [count, setCount] = useState(0);

useEffect(() => {
  if (!isInView) return;
  
  let startTime;
  const duration = 2000;  // 2 seconds
  const startValue = 0;
  const endValue = 10000;
  
  const animate = (currentTime) => {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth deceleration
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentCount = startValue + (endValue - startValue) * easeOutQuart;
    
    setCount(Math.floor(currentCount));
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
}, [isInView]);

<motion.div ref={ref}>
  {count.toLocaleString()}
</motion.div>
```

**Configuration**:
- **Margin**: `-100px` = animation starts 100px before element enters viewport
- **Once**: `true` = animation triggers only once (prevent re-trigger on scroll up)
- **Easing**: `easeOutQuart` = quick start, slow finish (feels satisfying)

**Alternative Easing Functions**:
```jsx
// Linear (constant speed)
const easeLinear = progress;

// Ease In Quad (slow start, fast end)
const easeInQuad = progress * progress;

// Ease Out Expo (very fast start, gradual stop)
const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
```

---

### 6. Infinite Scroll
```jsx
<motion.div
  animate={{ x: [0, -1000] }}  // Move 1000px left
  transition={{ 
    duration: 30,              // 30 seconds per loop
    repeat: Infinity,          // Loop forever
    ease: "linear"             // Constant speed
  }}
  className="flex gap-6"
>
  {[...testimonials, ...testimonials].map((item, i) => (
    <TestimonialCard key={i} testimonial={item} />
  ))}
</motion.div>
```

**Why Duplicate Array?**: Ensures seamless loop—when first set scrolls out, second set is visible

**Optional: Pause on Hover**:
```jsx
const controls = useAnimation();

<motion.div
  animate={controls}
  onHoverStart={() => controls.stop()}
  onHoverEnd={() => controls.start({ x: [0, -1000], transition: {...} })}
>
```

---

## 🎨 Styling Patterns

### Glassmorphism
```jsx
className="bg-surface-glass/50 backdrop-blur-md border border-glass-border"
```

**CSS Variables** (from `theme.css`):
```css
--surface-glass: rgba(7, 42, 44, 0.7);
--glass-border: color-mix(in oklab, rgba(15, 118, 110, 0.68), transparent 42%);
--blur-glass: 28px;
```

---

### Gradient Borders
```jsx
<div className="relative">
  {/* Gradient border trick */}
  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-400/20 blur-xl" />
  </div>
  
  {/* Actual content */}
  <div className="relative p-8 bg-surface-glass border border-glass-border rounded-2xl">
    Content
  </div>
</div>
```

**Effect**: Glowing gradient halo appears on hover

---

### Ripple Effect on Button
```jsx
<Button className="group relative overflow-hidden">
  {/* Ripple overlay */}
  <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
  
  {/* Button text */}
  <span className="relative">Get Started</span>
</Button>
```

**Effect**: Horizontal shine sweeps across button on hover (like loading bar)

---

## ⚡ Performance Optimization

### GPU Acceleration
Framer Motion automatically adds `transform: translateZ(0)` to animated elements, forcing GPU compositing. Manual override:
```jsx
<motion.div style={{ transform: 'translateZ(0)' }}>
```

---

### Will-Change Hints
For elements that animate frequently:
```css
.floating-element {
  will-change: transform;
}
```

**Warning**: Don't overuse—browsers reserve memory for will-change elements

---

### Reduce Motion Support
```jsx
import { useReducedMotion } from "framer-motion";

function MyComponent() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={shouldReduceMotion ? {} : { y: [0, -10, 0] }}
    >
      Content
    </motion.div>
  );
}
```

**CSS Alternative**:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-blob { animation: none; }
  .floating-element { transform: none !important; }
}
```

---

### Mobile Detection
```jsx
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || 'ontouchstart' in window;
};

// Disable heavy animations on mobile
const parallaxFactor = isMobile() ? 0 : 1.5;
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Magnetic Button Too Sensitive
**Symptom**: Button jumps erratically when cursor nearby  
**Fix**: Increase activation radius or reduce pull strength
```jsx
if (distance < 200) {  // Was 150
  setButtonOffset({ x: x * 0.15, y: y * 0.15 });  // Was 0.25
}
```

---

### Issue 2: 3D Tilt Doesn't Reset on Mouse Leave
**Symptom**: Card stays tilted after cursor leaves  
**Fix**: Ensure state resets in `onMouseLeave`
```jsx
onMouseLeave={() => {
  setIsHovered(false);
  setRotateX(0);
  setRotateY(0);
}}
```

---

### Issue 3: Counter Animation Re-triggers on Scroll
**Symptom**: Numbers reset when scrolling up/down  
**Fix**: Set `once: true` in `useInView`
```jsx
const isInView = useInView(ref, { once: true, margin: "-100px" });
```

---

### Issue 4: Infinite Scroll Stutters
**Symptom**: Testimonials pause or jump at loop boundary  
**Fix**: Ensure duplicate array has enough items
```jsx
const duplicatedTestimonials = [...testimonials, ...testimonials, ...testimonials];
```

---

### Issue 5: Parallax Causes Layout Shift (CLS)
**Symptom**: Content jumps when animations load  
**Fix**: Reserve space with min-height
```jsx
<section className="min-h-screen relative">
  {/* Parallax content */}
</section>
```

---

## 🧪 Testing Checklist

### Visual Testing
- [ ] **Hero**: Blobs animate smoothly, floating icons respond to cursor
- [ ] **Stats**: Counters animate from 0 on first viewport entry
- [ ] **Features**: Cards tilt in 3D, reset on mouse leave
- [ ] **Demo**: Before/After cards display correctly
- [ ] **Testimonials**: Infinite scroll loops seamlessly
- [ ] **CTA**: Magnetic button activates within radius

### Interaction Testing
- [ ] **Keyboard**: All buttons reachable via Tab key
- [ ] **Screen Reader**: Icon-only buttons have `aria-label`
- [ ] **Mobile**: Touch gestures don't break layout
- [ ] **Reduced Motion**: Animations disable with OS setting

### Performance Testing
- [ ] **Lighthouse**: Performance score > 90
- [ ] **FPS**: Consistent 60fps during scroll (use Chrome DevTools Performance tab)
- [ ] **Memory**: No leaks after 5 minutes of interaction (use Memory Profiler)

---

## 🔧 Customization Examples

### Change Animation Speed
```jsx
// Slower parallax
const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);  // Was 30%

// Faster counter animation
const duration = 1000;  // Was 2000 (1 second instead of 2)

// Longer infinite scroll
transition={{ duration: 60, ... }}  // Was 30 (60 seconds per loop)
```

---

### Adjust Color Scheme
```jsx
// Replace emerald with purple theme
<span className="bg-gradient-to-r from-purple-300 via-violet-200 to-indigo-300 bg-clip-text text-transparent">

// Update blob colors
<div className="bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl" />
```

---

### Add New Section
```jsx
// In LandingPageV2.jsx
function NewSection() {
  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2>New Section Title</h2>
        {/* Content */}
      </motion.div>
    </section>
  );
}

// Add to main component
<LandingPageV2>
  <HeroSection />
  <InteractiveStats />
  <NewSection />  {/* ← Insert here */}
  <FeaturesShowcase />
  ...
</LandingPageV2>
```

---

## 📊 Bundle Size Analysis

```bash
# Check Framer Motion impact
npm run build
npx vite-bundle-visualizer

# Expected sizes:
# - react.production.min.js: ~40KB
# - framer-motion: ~50KB
# - app code: ~90KB
# Total: ~180KB gzipped
```

**Optimization**: If bundle size is critical, use `framer-motion/dist/framer-motion.es.js` (tree-shakeable)

---

## 🚀 Deployment Steps

1. **Verify Framer Motion installed**:
```bash
npm list framer-motion
# Should show: framer-motion@11.x.x
```

2. **Test in production mode**:
```bash
npm run build
npm run preview
```

3. **Check for console errors**:
- Open DevTools → Console
- Interact with landing page (scroll, hover, click)
- No errors should appear

4. **Run Lighthouse audit**:
- Open DevTools → Lighthouse
- Run "Desktop" audit
- Target: Performance > 90, Accessibility > 95

5. **Deploy**:
```bash
git add .
git commit -m "feat: Add interactive landing page V2 with Framer Motion"
git push origin main
```

---

## 📝 Maintenance Notes

### Adding Testimonials
Edit the `testimonials` array in `LandingPageV2.jsx`:
```jsx
const testimonials = [
  {
    name: "New Person",
    role: "Job Title at Company",
    content: "Quote about experience..."
  },
  // ... existing testimonials
];
```

---

### Updating Stats
Edit the `stats` array:
```jsx
const stats = [
  { icon: Users, value: 15000, suffix: '+', label: 'Resumes Optimized' },  // Was 10000
  // ... other stats
];
```

---

### Changing Feature Cards
Edit the `features` array:
```jsx
const features = [
  {
    icon: NewIcon,
    title: "New Feature",
    description: "Description of the feature..."
  },
  // ... existing features
];
```

---

## 🎓 Learning Resources

- **Framer Motion Docs**: https://www.framer.com/motion/
- **useScroll Hook**: https://www.framer.com/motion/use-scroll/
- **useTransform Hook**: https://www.framer.com/motion/use-transform/
- **GPU Acceleration**: https://web.dev/animations-guide/
- **Reduced Motion**: https://web.dev/prefers-reduced-motion/

---

## 🔮 Future Enhancements

### Phase 2 (Optional)
1. **Lottie Animations**: Replace static demo with animated workflow
```bash
npm install lottie-react
```

2. **Intersection Observer Optimization**: Replace useInView with native API for better performance

3. **WebGL Background**: Add Three.js gradient mesh (if performance allows)

4. **A/B Testing**: Integrate with analytics to compare V1 vs V2

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Framer Motion docs for API changes
3. Test on different browsers (Chrome, Firefox, Safari)
4. Verify Tailwind classes are compiled correctly

---

**Last Updated**: 2025-10-22  
**Author**: Senior UI/UX Designer & Front-End Developer  
**Stack**: React 19 + Framer Motion 11 + Tailwind v4  
**Status**: ✅ Production Ready
