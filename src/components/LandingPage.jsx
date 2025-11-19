// src/components/LandingPage.jsx
// Modern landing page with hero section and feature showcase

import { useState } from "react";
import { ArrowRight, FileText, Target, Sparkles, Zap, Shield, TrendingUp, CheckCircle2, Star, Camera, FileImage } from "lucide-react";
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
            <span className="font-medium">Trusted by 10,000+ job seekers</span>
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
            Transform your resume in minutes. Upload images, PDFs, or screenshots. Match job descriptions perfectly with AI. Land more interviews.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group bg-white text-emerald-700 hover:bg-emerald-50 shadow-2xl shadow-emerald-900/50 px-8 py-6 text-lg font-semibold"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-white border-2 border-white/30 hover:bg-white/10 px-8 py-6 text-lg"
            >
              Watch Demo
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

          {/* OCR Feature Highlight Badge */}
          <div className="pt-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-400/30 text-white">
              <FileImage className="w-5 h-5 text-purple-300" />
              <span className="font-semibold">NEW: AI-Powered OCR</span>
              <span className="text-sm text-white/80">• Extract text from images & scans</span>
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
                  "bg-white/5 border-white/10 hover:bg-white/10 hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-500/20",
                  hoveredFeature === idx && "scale-105"
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

      {/* How It Works - Minimal */}
      <section className="px-4 py-20">
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
              className="group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-2xl shadow-emerald-900/50 px-12 py-6 text-lg font-semibold"
            >
              Start Optimizing Now
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
    icon: FileImage,
    title: "Advanced OCR Technology",
    description: "Upload resume images, screenshots, or scanned documents. Our AI-powered OCR extracts text with 95%+ accuracy."
  },
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
  }
];

const steps = [
  {
    title: "Upload Resume",
    description: "Drop your PDF/DOCX, upload an image, or paste text directly"
  },
  {
    title: "Match & Analyze",
    description: "Add job description and get instant AI-powered match score"
  },
  {
    title: "Optimize & Download",
    description: "Apply AI suggestions and export ATS-ready PDF"
  }
];

const stats = [
  { value: "10K+", label: "Resumes Optimized" },
  { value: "87%", label: "Higher Match Scores" },
  { value: "2.5x", label: "More Interviews" },
  { value: "< 5min", label: "Average Time" }
];
