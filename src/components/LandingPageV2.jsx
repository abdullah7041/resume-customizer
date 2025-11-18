// src/components/LandingPageV2.jsx
// Next-generation landing page with dynamic parallax and interactive elements

import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { 
  ArrowRight, FileText, Target, Sparkles, Zap, Shield, TrendingUp, 
  CheckCircle2, Star, Users, Award, Clock
} from "lucide-react";
import Button from "./ui/Button.jsx";
import { cn } from "../lib/cn.js";

export default function LandingPageV2({ onGetStarted }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <HeroSection onGetStarted={onGetStarted} scrollProgress={scrollYProgress} />
      <InteractiveStats />
      <FeaturesShowcase />
      <VisualDemo />
      <SocialProof />
      <FinalCTA onGetStarted={onGetStarted} />
    </div>
  );
}

// ========================================
// HERO SECTION - Parallax with Floating Elements
// ========================================
function HeroSection({ onGetStarted, scrollProgress }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });

  // Parallax background layers
  const y2 = useTransform(scrollProgress, [0, 1], ['0%', '50%']);
  const y3 = useTransform(scrollProgress, [0, 1], ['0%', '70%']);
  const opacity = useTransform(scrollProgress, [0, 0.5], [1, 0]);

  // Mouse parallax effect for floating elements
  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setMousePosition({
        x: (clientX - centerX) / 50,
        y: (clientY - centerY) / 50,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Magnetic button effect
  const handleButtonMouseMove = (e) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const distance = Math.sqrt(x * x + y * y);
    
    if (distance < 150) {
      setButtonOffset({ x: x * 0.25, y: y * 0.25 });
    } else {
      setButtonOffset({ x: 0, y: 0 });
    }
  };

  return (
    <motion.section 
      style={{ opacity }}
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20"
      onMouseMove={handleButtonMouseMove}
    >
      {/* Animated background layers */}
      <motion.div style={{ y: y3 }} className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </motion.div>

      {/* Floating decorative elements */}
      <FloatingElement 
        icon={FileText} 
        delay={0} 
        position={{ top: '15%', left: '10%' }}
        mouseOffset={mousePosition}
        parallaxFactor={1.5}
      />
      <FloatingElement 
        icon={Target} 
        delay={0.3} 
        position={{ top: '20%', right: '15%' }}
        mouseOffset={mousePosition}
        parallaxFactor={2}
      />
      <FloatingElement 
        icon={Sparkles} 
        delay={0.6} 
        position={{ bottom: '25%', left: '12%' }}
        mouseOffset={mousePosition}
        parallaxFactor={1.8}
      />
      <FloatingElement 
        icon={Zap} 
        delay={0.9} 
        position={{ bottom: '20%', right: '10%' }}
        mouseOffset={mousePosition}
        parallaxFactor={1.3}
      />

      {/* Main content */}
      <motion.div 
        style={{ y: y2 }}
        className="relative z-10 max-w-6xl mx-auto text-center space-y-8"
      >
        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm shadow-lg"
        >
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 animate-pulse" />
          <span className="font-medium">Trusted by 10,000+ job seekers worldwide</span>
        </motion.div>

        {/* Main Headline with staggered animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-tight">
            {['Land', 'Your', 'Dream', 'Job'].map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                className="inline-block mr-4"
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 1.1 }}
              className="block mt-4 bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent"
            >
              With AI-Powered Resumes
            </motion.span>
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="max-w-3xl mx-auto text-xl md:text-2xl text-white/90 leading-relaxed"
        >
          Transform your resume in minutes. Match job descriptions perfectly. 
          Get past ATS systems. <span className="text-emerald-300 font-semibold">Land more interviews.</span>
        </motion.p>

        {/* CTA Buttons with magnetic effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.5 }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8"
        >
          <motion.div
            ref={buttonRef}
            animate={{ x: buttonOffset.x, y: buttonOffset.y }}
            transition={{ type: "spring", stiffness: 150, damping: 15 }}
          >
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group relative bg-white text-emerald-700 hover:bg-emerald-50 shadow-2xl shadow-emerald-900/50 px-10 py-7 text-lg font-semibold overflow-hidden"
            >
              {/* Ripple effect on hover */}
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              <span className="relative flex items-center">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </span>
            </Button>
          </motion.div>

          <Button
            variant="ghost"
            size="lg"
            className="text-white border-2 border-white/30 hover:bg-white/10 hover:border-white/50 px-10 py-7 text-lg transition-all duration-300"
          >
            Watch Demo
          </Button>
        </motion.div>

        {/* Social Proof Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.7 }}
          className="flex flex-wrap justify-center items-center gap-6 pt-8"
        >
          {[
            { icon: CheckCircle2, text: "No credit card required" },
            { icon: CheckCircle2, text: "Free forever plan" },
            { icon: CheckCircle2, text: "Cancel anytime" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.8 + i * 0.1 }}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <item.icon className="w-5 h-5 text-emerald-300" />
              <span>{item.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
        >
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

// Floating element component with parallax
function FloatingElement({ icon: Icon, delay, position, mouseOffset, parallaxFactor }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 0.6, 
        scale: 1,
        x: mouseOffset.x * parallaxFactor,
        y: mouseOffset.y * parallaxFactor,
      }}
      transition={{ 
        opacity: { duration: 0.8, delay },
        scale: { duration: 0.8, delay },
        x: { type: "spring", stiffness: 50, damping: 20 },
        y: { type: "spring", stiffness: 50, damping: 20 },
      }}
      style={position}
      className="absolute hidden lg:block pointer-events-none"
    >
      <motion.div
        animate={{ 
          rotate: [0, 10, -10, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 5, 
          repeat: Infinity,
          delay: delay * 2
        }}
        className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-sm border border-white/10 shadow-xl"
      >
        <Icon className="w-8 h-8 text-emerald-300" />
      </motion.div>
    </motion.div>
  );
}

// ========================================
// INTERACTIVE STATS - Counter Animations
// ========================================
function InteractiveStats() {
  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-transparent via-white/5 to-transparent">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-white text-center mb-16"
        >
          Results That Speak for Themselves
        </motion.h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({ stat, delay }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      let startTime;
      const duration = 2000;
      const startValue = 0;
      const endValue = stat.value;

      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentCount = startValue + (endValue - startValue) * easeOutQuart;
        
        setCount(Math.floor(currentCount));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [isInView, stat.value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="group relative p-8 rounded-2xl bg-surface-glass/50 backdrop-blur-md border border-glass-border hover:border-emerald-400/50 transition-all duration-300 cursor-pointer"
    >
      {/* Radial progress background */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10" />
      </div>

      <div className="relative text-center space-y-3">
        <stat.icon className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
        <div className="text-5xl font-bold text-white">
          {isInView ? count.toLocaleString() : '0'}
          {stat.suffix}
        </div>
        <div className="text-white/70 text-lg">{stat.label}</div>
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl shadow-xl shadow-emerald-500/20" />
      </div>
    </motion.div>
  );
}

const stats = [
  { icon: Users, value: 10000, suffix: '+', label: 'Resumes Optimized' },
  { icon: TrendingUp, value: 87, suffix: '%', label: 'Higher Match Scores' },
  { icon: Award, value: 2.5, suffix: 'x', label: 'More Interviews' },
  { icon: Clock, value: 5, suffix: 'min', label: 'Average Time' },
];

// ========================================
// FEATURES SHOWCASE - 3D Tilt Cards
// ========================================
function FeaturesShowcase() {
  return (
    <section className="relative py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Everything You Need to Stand Out
          </h2>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            Powerful AI tools designed to give you an unfair advantage in the job market
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }) {
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
    
    setRotateY((x - centerX) / 10);
    setRotateX((centerY - y) / 10);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1000px",
      }}
      className="group relative h-full"
    >
      <motion.div
        animate={{
          rotateX: rotateX,
          rotateY: rotateY,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative p-8 rounded-2xl bg-surface-glass/50 backdrop-blur-md border border-glass-border hover:border-emerald-400/50 transition-all duration-300 h-full"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-400/20 blur-xl" />
        </div>

        <div className="relative" style={{ transform: "translateZ(50px)" }}>
          {/* Icon */}
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-6"
          >
            <feature.icon className="w-8 h-8 text-emerald-300" />
          </motion.div>

          {/* Content */}
          <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
          <p className="text-white/70 leading-relaxed mb-6">{feature.description}</p>

          {/* Hover indicator */}
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: isHovered ? '100%' : 0 }}
            className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

const features = [
  {
    icon: FileText,
    title: "Smart Resume Parsing",
    description: "Upload PDF, DOCX, or paste text. Our AI extracts and structures your experience instantly with precision."
  },
  {
    icon: Target,
    title: "Job Match Scoring",
    description: "Get instant 0-100 match scores. See exactly which keywords you're missing from job descriptions."
  },
  {
    icon: Sparkles,
    title: "AI Optimization",
    description: "Rewrite sections with stronger language and better keywords—without inventing facts or exaggerating."
  },
  {
    icon: TrendingUp,
    title: "Keyword Analysis",
    description: "Identify high-impact keywords and optimize your resume to beat ATS systems every time."
  },
  {
    icon: Shield,
    title: "ATS-Friendly Export",
    description: "Download professionally formatted PDFs that pass applicant tracking systems with flying colors."
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get actionable feedback in seconds. No waiting, no complicated setup. Just results."
  }
];

// ========================================
// VISUAL DEMO - Split Screen Animation
// ========================================
function VisualDemo() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-200px" });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section ref={ref} className="relative py-32 px-4 bg-gradient-to-b from-transparent via-white/5 to-transparent overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-white text-center mb-8"
        >
          See the Transformation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-white/80 text-center mb-16 max-w-2xl mx-auto"
        >
          Watch as your resume evolves from good to exceptional in real-time
        </motion.p>

        {/* Process Steps */}
        <div className="flex justify-center gap-4 mb-16">
          {['Upload', 'Analyze', 'Transform'].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={cn(
                "px-6 py-3 rounded-full border-2 transition-all duration-300",
                activeStep === i 
                  ? "bg-emerald-500 border-emerald-400 text-white scale-110" 
                  : "bg-white/5 border-white/20 text-white/60"
              )}
            >
              <span className="font-semibold">{i + 1}. {step}</span>
            </motion.div>
          ))}
        </div>

        {/* Visual comparison */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* Before */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative p-8 rounded-2xl bg-surface-glass/30 backdrop-blur-sm border border-white/10"
          >
            <div className="absolute top-4 left-4 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50 text-red-200 text-sm font-semibold">
              Before
            </div>
            <div className="mt-12 space-y-3 text-white/50 text-sm">
              <div className="font-bold text-base text-white/60">Software Developer</div>
              <p className="leading-relaxed">Worked on various projects and helped the team. Responsible for coding and debugging. Used different technologies to complete tasks.</p>
              <ul className="space-y-1.5 pl-4 text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>Coded features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>Fixed bugs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>Attended meetings</span>
                </li>
              </ul>
              <div className="pt-3 flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/40">Match: 23%</div>
                <div className="px-2 py-0.5 rounded bg-red-500/10 text-[10px] text-red-300">Weak Keywords</div>
              </div>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative p-8 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-sm border border-emerald-400/50 shadow-xl shadow-emerald-500/20"
          >
            <div className="absolute top-4 left-4 px-4 py-2 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              After
            </div>
            <div className="mt-12 space-y-3 text-white/90 text-sm">
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-bold text-base text-emerald-200"
              >
                Senior Full-Stack Software Engineer
              </motion.div>
              <p className="leading-relaxed">Led cross-functional agile team of 5 developers to architect and deploy scalable microservices platform, reducing system latency by 40% and supporting 2M+ daily active users.</p>
              <ul className="space-y-1.5 pl-4 text-xs">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Engineered</strong> RESTful APIs with Node.js and PostgreSQL, improving throughput by 35%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Automated</strong> CI/CD pipeline using Docker & Kubernetes, cutting deployment time by 60%</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span><strong>Mentored</strong> junior developers through code reviews and technical architecture sessions</span>
                </li>
              </ul>
              <div className="pt-3 flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] text-emerald-200 font-semibold"
                >
                  Match: 87%
                </motion.div>
                <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-[10px] text-emerald-300">Strong Keywords</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ========================================
// SOCIAL PROOF - Infinite Scroll Testimonials
// ========================================
function SocialProof() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Join Thousands of Success Stories
        </h2>
        <p className="text-xl text-white/80">Real results from real people</p>
      </motion.div>

      {/* Infinite scroll container */}
      <div className="relative">
        <motion.div
          animate={{ x: [0, -1000] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex gap-6"
        >
          {[...testimonials, ...testimonials].map((testimonial, i) => (
            <TestimonialCard key={i} testimonial={testimonial} />
          ))}
        </motion.div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#021114] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#021114] to-transparent pointer-events-none" />
    </section>
  );
}

function TestimonialCard({ testimonial }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      className="flex-shrink-0 w-96 p-6 rounded-2xl bg-surface-glass/50 backdrop-blur-md border border-glass-border"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-white">{testimonial.name}</div>
          <div className="text-sm text-white/60">{testimonial.role}</div>
        </div>
      </div>
      <div className="flex gap-1 mb-3">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-white/80 text-sm leading-relaxed">{testimonial.content}</p>
    </motion.div>
  );
}

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Software Engineer at Google",
    content: "Increased my interview rate by 300%. The AI optimization found keywords I completely missed. Got my dream job in 3 weeks!"
  },
  {
    name: "Marcus Williams",
    role: "Product Manager",
    content: "The match scoring feature is a game-changer. Went from 10% to 85% match rates. Landed 5 interviews in one week."
  },
  {
    name: "Priya Patel",
    role: "Data Scientist at Microsoft",
    content: "Finally passed ATS systems! The export format is perfect. Got callbacks from companies that ignored me before."
  },
  {
    name: "Alex Rodriguez",
    role: "UX Designer",
    content: "So easy to use. Transformed my generic resume into a targeted masterpiece. Wish I found this years ago!"
  }
];

// ========================================
// FINAL CTA - Magnetic Button with Depth
// ========================================
function FinalCTA({ onGetStarted }) {
  const buttonRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const distance = Math.sqrt(x * x + y * y);
    
    if (distance < 200) {
      setOffset({ x: x * 0.3, y: y * 0.3 });
    } else {
      setOffset({ x: 0, y: 0 });
    }
  };

  return (
    <section 
      className="relative py-32 px-4 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative max-w-4xl mx-auto text-center space-y-8"
      >
        <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">
          Ready to Transform Your
          <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
            Career Journey?
          </span>
        </h2>

        <p className="text-xl text-white/80 max-w-2xl mx-auto">
          Join 10,000+ professionals who've already landed their dream jobs with AI-optimized resumes
        </p>

        <motion.div
          ref={buttonRef}
          animate={{ x: offset.x, y: offset.y }}
          transition={{ type: "spring", stiffness: 150, damping: 20 }}
          className="pt-8"
        >
          <Button
            onClick={onGetStarted}
            size="lg"
            className="group relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-2xl shadow-emerald-900/50 px-16 py-8 text-xl font-bold overflow-hidden"
          >
            {/* Animated shine effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            
            <span className="relative flex items-center">
              Start Optimizing Now
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowRight className="ml-3 w-6 h-6" />
              </motion.div>
            </span>
          </Button>
        </motion.div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-white/70">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>256-bit encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>GDPR compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-emerald-400" />
            <span>4.9/5 rating</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
