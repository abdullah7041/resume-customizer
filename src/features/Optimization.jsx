import { useState } from "react";
import { Check, Download, Info, Lock, Share2, Sparkles } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton.jsx";
import SecondaryButton from "../components/ui/SecondaryButton.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import OptimizationCard from "../components/shared/OptimizationCard.jsx";

const sections = [
  { value: "summary", label: "Professional summary" },
  { value: "experience", label: "Work experience" },
  { value: "skills", label: "Skills" },
  { value: "education", label: "Education" },
];

export default function Optimization({ isPremium, onUpgrade, onOptimize, optimizations = [] }) {
  const [mode, setMode] = useState("auto");
  const [selectedSection, setSelectedSection] = useState(sections[0].value);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Step 3"
        title="Polish every section"
        description="Fine-tune your resume with recommendations that resonate in Saudi financial-tech circles."
      />

      {!isPremium && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-secondary-500/15 bg-secondary-500/5 p-6 text-left shadow-soft backdrop-blur-xl dark:border-surface-50/10 dark:bg-surface-900/60">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-500/15 text-secondary-500">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">Preview mode</p>
              <p className="text-sm text-ink-500 dark:text-sand-50/80">
                Preview the optimizer workflow with your data before you upgrade.
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-secondary-500/20 bg-secondary-500/10 px-3 py-1 text-xs text-secondary-600 shadow-soft dark:border-surface-50/20 dark:bg-surface-900/60 dark:text-sand-50/70">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="leading-none">Try the workflow for free—upgrade to save results.</span>
              </div>
            </div>
          </div>
          <div>
            <PrimaryButton onClick={onUpgrade} className="w-full justify-center sm:w-auto">
              Unlock premium insights
            </PrimaryButton>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Optimization mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="w-full rounded-[var(--radius-card)] border border-secondary-500/20 bg-surface-50/80 px-4 py-3 text-sm font-medium text-ink-700 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/12 dark:bg-surface-900/70 dark:text-sand-50 dark:focus-visible:ring-offset-surface-900"
          >
            <option value="auto">AI automatic — let the system choose what to improve</option>
            <option value="manual">Manual — focus on a specific section</option>
          </select>
        </label>

        {mode === "manual" && (
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Section</span>
            <select
              value={selectedSection}
              onChange={(event) => setSelectedSection(event.target.value)}
              className="w-full rounded-[var(--radius-card)] border border-secondary-500/20 bg-surface-50/80 px-4 py-3 text-sm font-medium text-ink-700 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/12 dark:bg-surface-900/70 dark:text-sand-50 dark:focus-visible:ring-offset-surface-900"
            >
              {sections.map((section) => (
                <option key={section.value} value={section.value}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <PrimaryButton
        icon={Sparkles}
        onClick={() => onOptimize?.(mode, selectedSection)}
        className="w-full justify-center"
      >
        Run AI optimization
      </PrimaryButton>

      {optimizations.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SecondaryButton icon={Check}>Accept all</SecondaryButton>
            <SecondaryButton icon={Download}>Export PDF</SecondaryButton>
            <SecondaryButton icon={Share2}>Share link</SecondaryButton>
          </div>
          <div className="space-y-4">
            {optimizations.map((optimization, index) => (
              <OptimizationCard
                key={index}
                optimization={optimization}
                index={index}
                onAccept={() => {}}
                onReject={() => {}}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/80 p-8 text-center text-sm text-ink-500/80 shadow-soft dark:border-surface-50/10 dark:bg-surface-900/60 dark:text-sand-50/70">
          Run an analysis to see AI-generated optimization cards appear here.
        </div>
      )}
    </div>
  );
}
