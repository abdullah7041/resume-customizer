import { useEffect, useId, useState, type ReactNode, type SyntheticEvent } from "react";
import { ArrowRight, Check, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTheme } from "../hooks/useTheme";
import { getSkylineUrls, SKYLINE_FALLBACK_URL } from "../lib/assets";
import { analytics } from "../services/analytics";

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn?: () => void;
}

type ThemeMode = "light" | "dark";

type TextItem = {
  text: string;
};

type KeyedCard = {
  k: string;
  title: string;
  body: string;
};

type NumberedQuestion = {
  n: string;
  text: string;
};

type ComparisonRow = {
  feature: string;
  watheq: string;
  c1: string;
  c2: string;
  c3: string;
  othersSummary: string;
};

type FaqItem = {
  q: string;
  a: string;
};

type TranslationApi = ReturnType<typeof useTranslation>;

const ARABIC_FINALE = "وثّق نجاحك";

function translatedArray<T>(t: TranslationApi["t"], key: string, fallback: T[]) {
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function localizedText(t: TranslationApi["t"], key: string, fallback: string) {
  const value = t(key);
  return typeof value === "string" && value !== key ? value : fallback;
}

function Numeral({ children }: { children: string }) {
  return <span className="majlis-num">{children}</span>;
}

function handleSkylineError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.src = SKYLINE_FALLBACK_URL;
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    console.warn("[LandingPage] Final CTA skyline asset failed to load; applied SVG fallback.");
  }
}

function SectionHeader({
  index,
  title,
  subtitle,
  id,
}: {
  index: string;
  title: string;
  subtitle?: string;
  id: string;
}) {
  return (
    <div className="majlis-section-head">
      <div className="majlis-section-title-row">
        <span className="majlis-section-index">{index}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  inverted = false,
}: {
  children: ReactNode;
  onClick: () => void;
  inverted?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={inverted ? "majlis-btn majlis-btn-ivory" : "majlis-btn majlis-btn-primary"}>
      <span>{children}</span>
      <ArrowRight className="majlis-arrow" aria-hidden="true" />
    </button>
  );
}

function MatchReport({ t }: { t: TranslationApi["t"] }) {
  const keywords = [
    ["Power BI", localizedText(t, "landing.majlis.matched", "matched")],
    [localizedText(t, "landing.majlis.kpiReporting", "KPI reporting"), localizedText(t, "landing.majlis.matched", "matched")],
    [
      localizedText(t, "landing.majlis.stakeholderMgmt", "Stakeholder management"),
      localizedText(t, "landing.majlis.addedFromEvidence", "added from evidence"),
    ],
  ];

  return (
    <aside className="majlis-match-card" aria-label={localizedText(t, "landing.majlis.matchReport", "Match report")}>
      <div className="majlis-card-header">
        <span>{localizedText(t, "landing.majlis.matchReport", "Match report")}</span>
        <span>{localizedText(t, "landing.majlis.example", "Example")}</span>
      </div>
      <div className="majlis-score-row">
        <span>{localizedText(t, "landing.majlis.beforeTailoring", "Before tailoring")}</span>
        <strong className="majlis-score-before">
          <Numeral>62</Numeral>
        </strong>
      </div>
      <div className="majlis-score-row">
        <span>{localizedText(t, "landing.majlis.afterTailoring", "After tailoring")}</span>
        <strong className="majlis-score-after">
          <Numeral>86</Numeral>
        </strong>
      </div>
      <div className="majlis-keyword-list">
        {keywords.map(([label, status]) => (
          <div key={label} className="majlis-keyword-row">
            <span>{label}</span>
            <span>{status}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DemoSection({ t, onGetStarted }: { t: TranslationApi["t"]; onGetStarted: () => void }) {
  const [optimized, setOptimized] = useState(false);
  const resultId = useId();
  const changes = translatedArray<TextItem>(t, "landing.majlis.changedList", []);
  const score = optimized ? "86%" : "52%";
  const bullet = optimized
    ? localizedText(
        t,
        "landing.majlis.bulletAfter",
        "Built weekly Power BI dashboards that helped leadership track KPI trends and prioritize stakeholder follow-ups across business units.",
      )
    : localizedText(t, "landing.majlis.bulletBefore", "Prepared weekly reports and dashboards for management.");

  return (
    <section id="mj2-demo" className="majlis-section" aria-labelledby="majlis-demo-title">
      <div className="majlis-container">
        <SectionHeader
          index="01"
          id="majlis-demo-title"
          title={localizedText(t, "landing.majlis.s1Title", "One weak line, rewritten honestly.")}
          subtitle={localizedText(
            t,
            "landing.majlis.s1Sub",
            "The same truth, made clearer for the job ad. Switch between the two - and notice what Watheq refuses to invent.",
          )}
        />

        <div className="majlis-demo-grid">
          <article className="majlis-demo-card">
            <div className="majlis-segmented" role="group" aria-label={localizedText(t, "landing.majlis.s1Title", "Demo state")}>
              <button type="button" className={!optimized ? "is-active" : ""} onClick={() => setOptimized(false)}>
                {localizedText(t, "landing.majlis.beforeTab", "Before")}
              </button>
              <button type="button" className={optimized ? "is-active" : ""} onClick={() => setOptimized(true)}>
                {localizedText(t, "landing.majlis.afterTab", "Optimized")}
              </button>
            </div>
            <div className="majlis-demo-score">
              <Numeral>{score}</Numeral> {localizedText(t, "landing.majlis.match", "match")} ·{" "}
              {localizedText(t, "landing.majlis.exampleSmall", "example")}
            </div>
            <p id={resultId} aria-live="polite" className="majlis-demo-bullet">
              {bullet}
            </p>
            <div className="majlis-target-signal">
              <span>{localizedText(t, "landing.majlis.targetSignal", "Target job signal")}</span>
              <p>
                {localizedText(
                  t,
                  "landing.majlis.targetSignalBody",
                  "The role asks for KPI reporting, Power BI, stakeholder management, and decision-support evidence.",
                )}
              </p>
            </div>
          </article>

          <aside className="majlis-panel-card">
            <span className="majlis-panel-kicker">{localizedText(t, "landing.majlis.changedTitle", "What changed - and what didn't")}</span>
            <ul>
              {changes.map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
            <div className="majlis-asked">
              <span>{localizedText(t, "landing.majlis.askedFirst", "Watheq asked first")}</span>
              <p>{localizedText(t, "landing.majlis.askedQuote", "Can you verify how many stakeholders used the dashboard?")}</p>
            </div>
          </aside>
        </div>

        <div className="majlis-repeat-cta">
          <PrimaryButton onClick={onGetStarted}>{localizedText(t, "landing.majlis.cta", "See your match score - free")}</PrimaryButton>
        </div>
      </div>
    </section>
  );
}

function WhySection({ t }: { t: TranslationApi["t"] }) {
  const cards = translatedArray<KeyedCard>(t, "landing.majlis.whyCards", []);
  return (
    <section className="majlis-section" aria-labelledby="majlis-why-title">
      <div className="majlis-container">
        <SectionHeader
          index="02"
          id="majlis-why-title"
          title={localizedText(t, "landing.majlis.s2Title", "One resume is not enough for every job.")}
          subtitle={localizedText(
            t,
            "landing.majlis.s2Sub",
            "Every job ad has different priorities, keywords, and proof expectations. Recruiters and ATS systems look for role-specific relevance.",
          )}
        />
        <div className="majlis-why-grid">
          {cards.map((card) => (
            <article key={card.k} className="majlis-why-card">
              <span>{card.k}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSections({ t }: { t: TranslationApi["t"] }) {
  const visionRows = translatedArray<TextItem>(t, "landing.majlis.visionRows", []);
  const clarifyQs = translatedArray<NumberedQuestion>(t, "landing.majlis.clarifyQs", []);
  const interviewQs = translatedArray<TextItem>(t, "landing.majlis.interviewQs", []);

  return (
    <section className="majlis-section" aria-labelledby="majlis-features-title">
      <div className="majlis-container">
        <SectionHeader index="03" id="majlis-features-title" title={localizedText(t, "landing.majlis.s3Title", "Three things no generic tool does.")} />

        <div className="majlis-feature-list">
          <article className="majlis-feature-row">
            <div className="majlis-feature-copy">
              <span>{localizedText(t, "landing.majlis.f1Kicker", "Vision 2030 alignment")}</span>
              <h3>{localizedText(t, "landing.majlis.f1Title", "Position yourself for Vision 2030 opportunities.")}</h3>
              <p>{localizedText(t, "landing.majlis.f1Body", "")}</p>
            </div>
            <div className="majlis-feature-card majlis-feature-card-green">
              <div className="majlis-card-header">
                <span>{localizedText(t, "landing.majlis.visionSignal", "Vision 2030 signal")}</span>
                <span>{localizedText(t, "landing.majlis.example", "Example")}</span>
              </div>
              <div className="majlis-vision-score">
                <Numeral>92</Numeral>
                <span>{localizedText(t, "landing.majlis.alignmentScore", "alignment score")}</span>
              </div>
              {visionRows.map((row) => (
                <div key={row.text} className="majlis-check-row">
                  <span>{row.text}</span>
                  <Check aria-hidden="true" />
                </div>
              ))}
            </div>
          </article>

          <article className="majlis-feature-row majlis-feature-row-reverse">
            <div className="majlis-feature-copy">
              <span>{localizedText(t, "landing.majlis.f2Kicker", "Ask-before-optimization")}</span>
              <h3>{localizedText(t, "landing.majlis.f2Title", "Smart questions before smart suggestions.")}</h3>
              <p>{localizedText(t, "landing.majlis.f2Body", "")}</p>
            </div>
            <div className="majlis-feature-card">
              <div className="majlis-card-header">
                <span>{localizedText(t, "landing.majlis.quickQuestions", "Quick questions")}</span>
                <span>{localizedText(t, "landing.majlis.qMeta", "3 questions · 1 minute")}</span>
              </div>
              {clarifyQs.map((question) => (
                <div key={question.n} className="majlis-question-row">
                  <span>{question.n}</span>
                  <p>{question.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="majlis-feature-row">
            <div className="majlis-feature-copy">
              <span>{localizedText(t, "landing.majlis.f3Kicker", "Interview preparation")}</span>
              <h3>{localizedText(t, "landing.majlis.f3Title", "Practice with questions from your own resume.")}</h3>
              <p>{localizedText(t, "landing.majlis.f3Body", "")}</p>
            </div>
            <div className="majlis-feature-card">
              <div className="majlis-card-header">
                <span>{localizedText(t, "landing.majlis.interviewPrep", "Interview prep")}</span>
                <span>{localizedText(t, "landing.majlis.roleSpecific", "Role-specific")}</span>
              </div>
              {interviewQs.map((question) => (
                <div key={question.text} className="majlis-interview-row">
                  {question.text}
                </div>
              ))}
              <p className="majlis-practice-note">{localizedText(t, "landing.majlis.practiceNote", "Practice with the same claims used in your tailored resume.")}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection({ t }: { t: TranslationApi["t"] }) {
  const rows = translatedArray<ComparisonRow>(t, "landing.majlis.comparisonRows", []);
  const columns = [
    localizedText(t, "landing.majlis.brand", "Watheq"),
    localizedText(t, "landing.majlis.colGeneric", "Generic builder"),
    localizedText(t, "landing.majlis.colScanner", "Keyword scanner"),
    localizedText(t, "landing.majlis.colManual", "Manual editing"),
  ];

  return (
    <section className="majlis-section" aria-labelledby="majlis-comparison-title">
      <div className="majlis-container">
        <SectionHeader index="04" id="majlis-comparison-title" title={localizedText(t, "landing.majlis.s4Title", "Compare proof, not just templates.")} />
        <div className="majlis-comparison-table" role="table">
          <div className="majlis-comparison-head" role="row">
            <span role="columnheader" aria-hidden="true" />
            {columns.map((column) => (
              <span key={column} role="columnheader">
                {column}
              </span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.feature} className="majlis-comparison-row" role="row">
              <strong role="cell">{row.feature}</strong>
              <span role="cell">{row.watheq}</span>
              <span role="cell">{row.c1}</span>
              <span role="cell">{row.c2}</span>
              <span role="cell">{row.c3}</span>
            </div>
          ))}
        </div>
        <div className="majlis-comparison-mobile">
          {rows.map((row) => (
            <article key={row.feature} className="majlis-mobile-compare-card">
              <h3>{row.feature}</h3>
              <p>
                <strong>{localizedText(t, "landing.majlis.brand", "Watheq")}:</strong> {row.watheq}
              </p>
              <p>
                <strong>{localizedText(t, "landing.majlis.others", "Others")}:</strong> {row.othersSummary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ t, onGetStarted }: { t: TranslationApi["t"]; onGetStarted: () => void }) {
  const freeFeatures = translatedArray<TextItem>(t, "landing.majlis.freeFeatures", []);
  const proFeatures = translatedArray<TextItem>(t, "landing.majlis.proFeatures", []);

  return (
    <section id="mj2-pricing" className="majlis-section" aria-labelledby="majlis-pricing-title">
      <div className="majlis-container">
        <SectionHeader index="05" id="majlis-pricing-title" title={localizedText(t, "landing.majlis.s5Title", "Start free. Everything you need to apply.")} />
        <div className="majlis-pricing-grid">
          <article className="majlis-price-card majlis-price-card-free">
            <div className="majlis-price-head">
              <h3>{localizedText(t, "landing.majlis.free", "Free")}</h3>
              <span>{localizedText(t, "landing.majlis.liveNow", "Live now")}</span>
            </div>
            <p className="majlis-price">
              <Numeral>{localizedText(t, "landing.majlis.freePrice", "0 SAR")}</Numeral>
              <span>{localizedText(t, "landing.majlis.forever", "/ forever")}</span>
            </p>
            {freeFeatures.map((feature) => (
              <div key={feature.text} className="majlis-check-row">
                <span>{feature.text}</span>
                <Check aria-hidden="true" />
              </div>
            ))}
            <PrimaryButton onClick={onGetStarted}>{localizedText(t, "landing.majlis.navCta", "Check my match")}</PrimaryButton>
          </article>

          <article className="majlis-price-card majlis-price-card-pro">
            <div className="majlis-price-head">
              <h3>{localizedText(t, "landing.majlis.pro", "Pro")}</h3>
              <span>{localizedText(t, "landing.majlis.waitlist", "Waitlist")}</span>
            </div>
            <p className="majlis-price">
              <Numeral>{localizedText(t, "landing.majlis.proPrice", "29 SAR")}</Numeral>
              <span>{localizedText(t, "landing.majlis.perMonth", "/ month · planned")}</span>
            </p>
            {proFeatures.map((feature) => (
              <div key={feature.text} className="majlis-check-row majlis-check-row-gold">
                <span>{feature.text}</span>
                <Check aria-hidden="true" />
              </div>
            ))}
            <a className="majlis-btn majlis-btn-secondary" href="#mj2-faq">
              {localizedText(t, "landing.majlis.proCta", "Join the pricing waitlist")}
            </a>
          </article>
        </div>
        <p className="majlis-pricing-note">{localizedText(t, "landing.majlis.pricingNote", "Paid plans are not live yet - the waitlist helps shape launch pricing.")}</p>
      </div>
    </section>
  );
}

function FaqSection({ t }: { t: TranslationApi["t"] }) {
  const faqs = translatedArray<FaqItem>(t, "landing.majlis.faqs", []);
  return (
    <section id="mj2-faq" className="majlis-section" aria-labelledby="majlis-faq-title">
      <div className="majlis-container majlis-faq-grid">
        <SectionHeader
          index="06"
          id="majlis-faq-title"
          title={localizedText(t, "landing.majlis.s6Title", "Questions, answered.")}
          subtitle={localizedText(t, "landing.majlis.s6Sub", "The honest version, including what Watheq can't do yet.")}
        />
        <div className="majlis-faq-list">
          {faqs.map((faq) => (
            <details key={faq.q}>
              <summary>
                <span>{faq.q}</span>
                <span aria-hidden="true">+</span>
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ t, onGetStarted }: { t: TranslationApi["t"]; onGetStarted: () => void }) {
  const skylineUrls = getSkylineUrls();
  return (
    <section className="majlis-final-cta" aria-labelledby="majlis-final-title" data-testid="majlis-final-cta">
      <img src={skylineUrls.desktop} alt="" decoding="async" loading="lazy" onError={handleSkylineError} />
      <div className="majlis-final-overlay" />
      <div className="majlis-final-content">
        <p>{ARABIC_FINALE}</p>
        <h2 id="majlis-final-title">{localizedText(t, "landing.majlis.ctaTitle", "See where you stand before you hit apply.")}</h2>
        <span>{localizedText(t, "landing.majlis.ctaSub", "Your real match score takes about two minutes. Free, in Arabic or English.")}</span>
        <PrimaryButton inverted onClick={onGetStarted}>
          {localizedText(t, "landing.majlis.cta", "See your match score - free")}
        </PrimaryButton>
      </div>
    </section>
  );
}

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const { t, i18n } = useTranslation();
  const [theme, toggleTheme] = useTheme() as readonly [ThemeMode, () => void];
  const isArabic = i18n.language === "ar";

  useEffect(() => {
    analytics.trackLandingViewed();
  }, []);

  const handleCta = (source: "hero" | "walkthrough" | "final_cta") => {
    analytics.trackGetStartedClicked(source);
    onGetStarted();
  };

  const toggleLanguage = () => {
    const nextLanguage = isArabic ? "en" : "ar";
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <main className="majlis-page" dir={isArabic ? "rtl" : "ltr"}>
      <nav className="majlis-nav" aria-label="Landing">
        <a className="majlis-brand" href="#top" aria-label={localizedText(t, "landing.majlis.brand", "Watheq")}>
          <span>واثق</span>
          <span>WATHEQ</span>
        </a>
        <div className="majlis-nav-links">
          <a href="#mj2-demo">{localizedText(t, "landing.majlis.navProof", "The proof")}</a>
          <a href="#mj2-pricing">{localizedText(t, "landing.majlis.navPricing", "Pricing")}</a>
          <a href="#mj2-faq">{localizedText(t, "landing.majlis.navFaq", "Questions")}</a>
        </div>
        <div className="majlis-nav-actions">
          <button type="button" className="majlis-icon-btn" onClick={toggleTheme} aria-label={localizedText(t, "common.toggleTheme", "Toggle theme")}>
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button type="button" className="majlis-lang-btn" onClick={toggleLanguage}>
            {localizedText(t, "landing.majlis.langBtn", "العربية")}
          </button>
          {onSignIn ? (
            <button type="button" className="majlis-signin" onClick={onSignIn}>
              {localizedText(t, "landing.majlis.signIn", "Sign in")}
            </button>
          ) : null}
          <button type="button" className="majlis-nav-cta" onClick={() => handleCta("hero")}>
            {localizedText(t, "landing.majlis.navCta", "Check my match")}
          </button>
        </div>
      </nav>

      <section id="top" className="majlis-hero" aria-labelledby="majlis-hero-title">
        <div className="majlis-container majlis-hero-grid">
          <div className="majlis-hero-copy">
            <div className="majlis-kicker-row">
              <span />
              <p>
                <strong>{localizedText(t, "landing.majlis.kickerMain", "Built for Saudi careers")}</strong>
                <em>{localizedText(t, "landing.majlis.kickerSub", "مصمم للوظائف السعودية")}</em>
              </p>
            </div>
            <h1 id="majlis-hero-title">
              {localizedText(t, "landing.majlis.heroL1", "Every job reads differently.")}
              <br />
              {localizedText(t, "landing.majlis.heroL2", "So should your resume.")}
            </h1>
            <p>{localizedText(t, "landing.majlis.heroSub", "")}</p>
            <div className="majlis-hero-actions">
              <PrimaryButton onClick={() => handleCta("hero")}>{localizedText(t, "landing.majlis.cta", "See your match score - free")}</PrimaryButton>
              <a href="#mj2-demo">{localizedText(t, "landing.majlis.heroLink", "Read a real example")}</a>
            </div>
            <span className="majlis-hero-note">{localizedText(t, "landing.majlis.heroNote", "Free to start · No invented experience, ever")}</span>
          </div>
          <MatchReport t={t} />
        </div>
      </section>

      <DemoSection t={t} onGetStarted={() => handleCta("walkthrough")} />
      <WhySection t={t} />
      <FeatureSections t={t} />
      <ComparisonSection t={t} />
      <PricingSection t={t} onGetStarted={() => handleCta("walkthrough")} />
      <FaqSection t={t} />
      <FinalCta t={t} onGetStarted={() => handleCta("final_cta")} />

      <footer className="majlis-footer">
        <div className="majlis-container">
          <p>
            <strong>واثق</strong>
            <span>{localizedText(t, "landing.majlis.footerTag", "Watheq · Built for Saudi careers")}</span>
          </p>
          <nav aria-label="Footer">
            <a href="/privacy">{localizedText(t, "landing.majlis.privacy", "Privacy")}</a>
            <a href="/terms">{localizedText(t, "landing.majlis.terms", "Terms")}</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
