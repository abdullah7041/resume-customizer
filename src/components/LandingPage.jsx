// src/components/LandingPage.jsx
// Modern landing page with hero section and feature showcase

import { useState } from "react";
import { ArrowRight, FileText, Target, Sparkles, Zap, Shield, TrendingUp, CheckCircle2, Star } from "lucide-react";
import Button from "./ui/Button.jsx";
import { cn } from "../lib/cn.js";

export default function LandingPage({ onGetStarted }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>

        <div className="relative max-w-6xl mx-auto text-center space-y-8">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">Designed for Saudi Talent</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            Land Your Dream Job with
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              AI-Powered Resumes
            </span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-xl md:text-2xl text-white/90 leading-relaxed">
            Transform your resume in minutes. Match job descriptions perfectly. Get past ATS systems. Land more interviews.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group relative overflow-hidden bg-white text-emerald-700 hover:bg-emerald-50 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.6)] px-8 py-6 text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="group text-white border-2 border-white/30 bg-white/5 backdrop-blur-sm hover:bg-white/20 hover:border-white/50 px-8 py-6 text-lg font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="flex items-center gap-2">
                Watch Demo
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse group-hover:bg-red-400" />
              </span>
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-white/70 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Stand Out
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Powerful AI tools designed to give you an unfair advantage in the job market
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredFeature(idx)}
                onMouseLeave={() => setHoveredFeature(null)}
                className={cn(
                  "group relative p-8 rounded-2xl border transition-all duration-300 cursor-pointer",
                  "bg-white/5 border-white/10 hover:bg-white/10 hover:border-emerald-400/50 hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.15)]",
                  hoveredFeature === idx ? "scale-105 -translate-y-1" : "hover:-translate-y-1"
                )}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 group-hover:from-emerald-500/30 group-hover:to-teal-500/30"
                  )}>
                    <feature.icon className="w-6 h-6 text-emerald-300" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-white/70 leading-relaxed">{feature.description}</p>

                {/* Hover effect indicator */}
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-b-2xl transition-opacity duration-300",
                  hoveredFeature === idx ? "opacity-100" : "opacity-0"
                )} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Transformation Showcase */}
      <section className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              See the Difference
            </h2>
            <p className="text-xl text-white/80">
              Don't let generic bullets hold you back.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Before Card */}
            <div className="relative p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider border border-red-500/20">
                Before
              </div>
              <div className="h-full flex flex-col justify-center">
                <p className="text-lg text-white/60 font-medium line-through decoration-red-500/50 decoration-2">
                  "Managed sales team and increased revenue."
                </p>
                <p className="mt-4 text-sm text-white/40">
                  ❌ Vague impact
                  <br />
                  ❌ No metrics
                  <br />
                  ❌ Generic phrasing
                </p>
              </div>
            </div>

            {/* After Card */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 backdrop-blur-sm shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                After (Saudi-Ready)
              </div>
              <div className="h-full flex flex-col justify-center">
                <p className="text-lg text-white font-medium leading-relaxed">
                  "Spearheaded a high-performing sales unit of 15, driving <span className="text-emerald-400 font-bold">SAR 12M</span> in annual revenue and expanding market share by <span className="text-emerald-400 font-bold">18%</span> across the Eastern Province."
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    ✓ Quantifiable Impact
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    ✓ Local Context
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    ✓ Strong Action Verbs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Minimal */}
      <section className="relative px-4 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/20 pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            Get Results in 3 Simple Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl font-bold shadow-lg">
                  {idx + 1}
                </div>
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                <p className="text-white/70">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="text-center mt-16">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-500 text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.6)] px-12 py-6 text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Optimizing Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s] duration-0 group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 bg-white/5 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-white">{stat.value}</div>
                <div className="text-white/70 text-sm md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const features = [
  {
    icon: FileText,
    title: "Smart Resume Parsing",
    description: "Upload PDF, DOCX, or paste text. Our AI extracts and structures your experience instantly."
  },
  {
    icon: Target,
    title: "Job Match Scoring",
    description: "Get instant 0-100 match scores. See exactly which keywords you're missing from job descriptions."
  },
  {
    icon: Sparkles,
    title: "AI Optimization",
    description: "Rewrite sections with stronger language and better keywords—without inventing facts."
  },
  {
    icon: TrendingUp,
    title: "Keyword Analysis",
    description: "Identify high-impact keywords and optimize your resume to beat ATS systems."
  },
  {
    icon: Shield,
    title: "ATS-Friendly Export",
    description: "Download professionally formatted PDFs that pass applicant tracking systems."
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get actionable feedback in seconds. No waiting, no complicated setup."
  }
];

const steps = [
  {
    title: "Upload Resume",
    description: "Drop your PDF/DOCX or paste text directly"
  },
  {
    title: "Match & Analyze",
    description: "Add job description and get instant match score"
  },
  {
    title: "Optimize & Download",
    description: "Apply AI suggestions and export ATS-ready PDF"
  }
];

const stats = [
  { value: "100%", label: "Saudi Market Focus" },
  { value: "AI", label: "Powered Analysis" },
  { value: "24/7", label: "Instant Feedback" },
  { value: "Vision", label: "2030 Aligned" }
];
