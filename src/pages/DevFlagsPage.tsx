import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FEATURE_FLAGS } from "@/lib/featureFlags/registry";
import { useFeatureFlagStore } from "@/lib/stores/featureFlagStore";
import type {
  FeatureFlagDefinition,
  FeatureFlagName,
  FlagTestFileResult,
  FlagTestReport,
} from "@/types/featureFlags";

/**
 * Dev-only feature-flags control panel. Mounted at `/dev/flags` and only
 * reachable in dev builds (App.tsx tree-shakes the import via `import.meta.env.DEV`).
 * English-only — internal tooling, no i18n keys.
 */

// Eagerly load any generated test report. Empty object when the report has not
// been generated yet (`npm run flags:report`).
const reportModules = import.meta.glob<{ default: FlagTestReport }>(
  "../lib/featureFlags/report/*.json",
  { eager: true }
);

function loadReport(): FlagTestReport | null {
  const first = Object.values(reportModules)[0];
  return first?.default ?? null;
}

const MATURITY_STYLES: Record<FeatureFlagDefinition["maturity"], string> = {
  stable: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  beta: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  experimental: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

function TestResults({ results }: { results: FlagTestFileResult[] | undefined }) {
  if (!results || results.length === 0) {
    return <span className="text-xs text-white/40">no report</span>;
  }
  return (
    <ul className="space-y-1">
      {results.map((r) => (
        <li key={r.file} className="flex items-center gap-2 text-xs">
          <span
            className={
              r.status === "pass"
                ? "text-emerald-400"
                : "text-rose-400"
            }
            aria-hidden
          >
            {r.status === "pass" ? "PASS" : "FAIL"}
          </span>
          <span className="font-mono text-white/70">{r.file}</span>
          {r.failed > 0 && (
            <span className="text-rose-400">
              {r.failed}/{r.total} failed
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function DevFlagsPage() {
  const { user, loading } = useAuth();
  // In dev anyone can open the panel; in prod it is admin-only (same gate as
  // AdminFeedbackPage: app_metadata.role === "admin").
  const isAdmin = user?.app_metadata?.role === "admin";
  const allowed = import.meta.env.DEV || isAdmin;

  if (!loading && !allowed) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-md px-4 py-24 text-center text-white">
        <h1 className="text-xl font-semibold">Feature Flags</h1>
        <p className="mt-2 text-sm text-white/60">
          This panel is restricted to administrators.
        </p>
      </main>
    );
  }

  return <FlagsDashboard />;
}

function FlagsDashboard() {
  const overrides = useFeatureFlagStore((s) => s.overrides);
  const setOverride = useFeatureFlagStore((s) => s.setOverride);
  const clearOverride = useFeatureFlagStore((s) => s.clearOverride);
  const resetAll = useFeatureFlagStore((s) => s.resetAll);

  const report = useMemo(() => loadReport(), []);
  const flags = useMemo(
    () => Object.values(FEATURE_FLAGS) as FeatureFlagDefinition[],
    []
  );

  const resolve = (name: FeatureFlagName): boolean =>
    overrides[name] ?? FEATURE_FLAGS[name].defaultEnabled;

  return (
    <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 text-white">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Feature Flags</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Dev-only control panel. Toggles persist in{" "}
            <code className="rounded bg-white/10 px-1">watheq:featureFlags</code>{" "}
            and are ignored in production builds. Run{" "}
            <code className="rounded bg-white/10 px-1">npm run flags:report</code>{" "}
            to refresh test results.
          </p>
          {report && (
            <p className="mt-2 text-xs text-white/40">
              Test report generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => resetAll()}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          Reset all
        </button>
      </header>

      <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">Feature</th>
              <th className="px-4 py-3">Maturity</th>
              <th className="px-4 py-3">Tests</th>
              <th className="px-4 py-3 text-right">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {flags.map((flag) => {
              const enabled = resolve(flag.name);
              const overridden = overrides[flag.name] !== undefined;
              return (
                <tr key={flag.name} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{flag.label}</span>
                      {overridden && (
                        <button
                          type="button"
                          onClick={() => clearOverride(flag.name)}
                          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
                          title="Clear override (revert to default)"
                        >
                          overridden · reset
                        </button>
                      )}
                    </div>
                    <p className="mt-1 max-w-md text-xs text-white/50">
                      {flag.description}
                    </p>
                    <code className="mt-1 block text-[10px] text-white/30">
                      {flag.name}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${MATURITY_STYLES[flag.maturity]}`}
                    >
                      {flag.maturity}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <TestResults results={report?.results[flag.name]} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`Toggle ${flag.label}`}
                      onClick={() => setOverride(flag.name, !enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? "bg-emerald-500" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
