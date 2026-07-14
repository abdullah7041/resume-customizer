import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const visible = { opacity: 1, y: 0 };

interface FeatureHighlightSectionProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  benefits: string[];
  visual: ReactNode;
  reverse?: boolean;
  accentColor?: string;
  bgClassName?: string;
  sectionId?: string;
}

export function FeatureHighlightSection({
  eyebrow,
  title,
  subtitle,
  benefits,
  visual,
  reverse = false,
  accentColor = "text-[#2b8994] dark:text-emerald-300",
  bgClassName,
  sectionId,
}: FeatureHighlightSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  const fadeUp = shouldReduceMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: 24 };

  return (
    <section
      id={sectionId}
      className={cn(
        "px-5 py-16 sm:px-8 lg:py-24",
        bgClassName ?? "bg-white dark:bg-[#031713]"
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <motion.div
            initial={fadeUp}
            whileInView={visible}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn("space-y-6", reverse && "lg:order-2")}
          >
            <span
              className={cn(
                "inline-block text-sm font-black uppercase tracking-[0.16em]",
                accentColor
              )}
            >
              {eyebrow}
            </span>

            <h2 className="text-3xl font-black leading-[0.98] text-[#171717] dark:text-white sm:text-4xl lg:text-5xl">
              {title}
            </h2>

            <p className="max-w-lg text-lg leading-8 text-slate-600 dark:text-white/62">
              {subtitle}
            </p>

            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-2xl bg-[#f4f9f7]/70 p-3.5 text-sm font-bold leading-6 text-[#0c3541] shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.05] dark:text-white/78 dark:ring-white/10"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2b8994] dark:text-emerald-300" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={fadeUp}
            whileInView={visible}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            className={cn("relative", reverse && "lg:order-1")}
          >
            {visual}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
