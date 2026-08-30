import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Building2, ExternalLink, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useActiveResume, useSearchIntent } from '@/lib/stores/resumeStore';
import { createJobApplication } from '@/services/pipeline';
import {
  getPostingDescription,
  listFeedState,
  listOpenPostings,
  listTrackedCompanies,
  fetchServerSearchIntent,
  readLastFeedSeenAt,
  resolveCompany,
  setFeedState,
  touchLastFeedSeenAt,
  trackCompany,
  untrackCompany,
  type ResolutionCandidate,
  type ResolutionReport,
  type TrackedCompany,
} from '@/services/jobFeed';
import { BASE_SCORE, buildFeed, isNew, TERM_WEIGHT } from '@/lib/jobs/score';
import { deriveRoleTerms } from '@/lib/jobs/filters';
import { looseArabicKey, normalizeText } from '@/lib/jobs/normalize';
import {
  SAUDI_STARTER_COMPANIES,
  unfollowedStarters,
  type StarterCompany,
} from '@/lib/jobs/saudiStarterCompanies';
import type { FeedIntent, FeedPosting, ScoredPosting } from '@/lib/jobs/types';

const MAX_TRACKED_COMPANIES = 25;

interface JobFeedSectionProps {
  /** Hands a posting to the Match tab. The feed never scores against the CV itself. */
  onMatchPosting?: (input: { jobDescription: string; companyName: string; jobTitle: string }) => void;
}

export function JobFeedSection({ onMatchPosting }: JobFeedSectionProps) {
  const { t, i18n } = useTranslation();
  // Defensive: consumers can render this without a full i18n instance.
  const language = i18n?.language ?? 'en';
  const reduceMotion = useReducedMotion();
  const searchIntent = useSearchIntent();
  const resume = useActiveResume();

  const [companies, setCompanies] = useState<TrackedCompany[]>([]);
  const [postings, setPostings] = useState<FeedPosting[]>([]);
  const [feedState, setFeedStateMap] = useState<Map<string, 'dismissed' | 'saved'>>(new Map());
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [serverIntent, setServerIntent] = useState<FeedIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether the last load failed, kept as a flag rather than a translated string.
   *
   * Storing the sentence meant `load` had to close over `t`, which put `t` in its
   * dependency list and made the load effect re-run whenever react-i18next handed
   * back a new `t` — six setState calls, a re-render, another `t`, and so on. That
   * loop is React error #185, and it only ever fired in production, where i18n
   * emits load events that dev never produced. The view decides the wording; the
   * state only records that something failed.
   */
  const [loadFailed, setLoadFailed] = useState(false);

  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState<ResolutionReport | null>(null);
  /**
   * A query that names a company we already know, matched on either language.
   *
   * Kept apart from the server's resolution because it needs no probe at all: the
   * source and token are already verified, so this path is instant and cannot fail.
   */
  const [starterMatch, setStarterMatch] = useState<StarterCompany | null>(null);
  const [busyCompany, setBusyCompany] = useState<string | null>(null);

  // Local store first — it is the freshest — then whatever the profile holds.
  const intent: FeedIntent | null = useMemo(() => {
    if (searchIntent?.targetRoles?.length) {
      return { targetRoles: searchIntent.targetRoles, seniority: searchIntent.seniority };
    }
    return serverIntent;
  }, [searchIntent, serverIntent]);

  /**
   * Past employers from the parsed CV, offered as one-tap starting points.
   * Typing 25 company names is still searching, which is the chore this feature
   * exists to remove. Names only — resolving fans out across every provider, so it
   * happens on tap, never for a whole suggestion list at once.
   */
  const suggestions = useMemo(() => {
    const tracked = new Set(companies.map((company) => company.displayName.toLowerCase()));
    // A company already offered as a starter is skipped here: that chip tracks it
    // directly from a known token, while this path has to probe every provider for
    // a name that may not even be the handle.
    const alreadyOffered = new Set(
      SAUDI_STARTER_COMPANIES.map((company) => company.displayName.toLowerCase()),
    );
    const seen = new Set<string>();
    const names: string[] = [];

    for (const entry of resume?.work ?? []) {
      const name = (entry?.name ?? '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key) || tracked.has(key) || alreadyOffered.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names.slice(0, 6);
  }, [resume, companies]);

  /**
   * Saudi employers whose boards are already verified readable. Tapping one skips
   * resolution entirely — the source and token are known, so there is nothing to
   * probe and no fan-out across providers.
   */
  const starters = useMemo(
    () => unfollowedStarters(companies.map((company) => company.token)),
    [companies],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);

    const { companies: tracked, error: companiesError } = await listTrackedCompanies();
    if (companiesError) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }

    const [{ postings: open, error: postingsError }, state, seen, profileIntent] = await Promise.all([
      listOpenPostings(tracked),
      listFeedState(),
      readLastFeedSeenAt(),
      fetchServerSearchIntent(),
    ]);

    if (postingsError) {
      setLoadFailed(true);
    }

    setCompanies(tracked);
    setPostings(open);
    setFeedStateMap(state);
    setLastSeenAt(seen);
    setServerIntent(profileIntent);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Advance the marker when the user leaves, not when the list finishes loading.
   *
   * Stamping on load marks every currently-new posting as seen the instant the tab
   * opens — including rows below the fold, and including someone who opens the tab
   * and immediately leaves. That is exactly the flood the two-clause predicate
   * exists to prevent, reintroduced at the call site.
   */
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!loading) hasLoadedRef.current = true;
  }, [loading]);
  useEffect(
    () => () => {
      if (hasLoadedRef.current) void touchLastFeedSeenAt();
    },
    [],
  );

  const trackedSinceById = useMemo(
    () => new Map(companies.map((company) => [company.companyId, company.trackedSince])),
    [companies],
  );

  /**
   * The best score this user's intent can produce.
   *
   * A raw score is meaningless on its own: with one target role the ceiling is 70,
   * with three it is 85. Showing 70 identically in both cases is what made every
   * row look the same shade — in the one-role case a 70 really is a full match, and
   * painting it amber would be as wrong as painting a partial one green. Rows are
   * scored against this ceiling so the badge answers "how much of what you asked
   * for does this have", which is the only question the number can honestly answer.
   */
  const maxScore = useMemo(() => {
    if (!intent) return BASE_SCORE;
    return Math.min(100, BASE_SCORE + deriveRoleTerms(intent.targetRoles).length * TERM_WEIGHT);
  }, [intent]);

  const feed = useMemo(() => {
    if (!intent) return null;
    const visible = postings.filter((posting) => !feedState.has(posting.id));
    return buildFeed(visible, intent);
  }, [postings, feedState, intent]);

  const handleResolve = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setResolving(true);
    setResolution(null);
    setStarterMatch(null);

    /*
     * Try the registry first, in either language.
     *
     * `toHandle` derives an ATS handle by stripping everything outside [a-z0-9-],
     * so an Arabic company name collapsed to an empty string and no board was ever
     * probed — "تامارا" could never resolve while "Tamara" did. The registry
     * already carries both names, so a known company matches before any network
     * call, and Arabic reaches the same place English does.
     */
    const normalized = normalizeText(trimmed);
    const loose = looseArabicKey(trimmed);
    const known = SAUDI_STARTER_COMPANIES.find(
      (company) =>
        normalizeText(company.displayName) === normalized ||
        normalizeText(company.displayNameAr) === normalized ||
        normalizeText(company.token) === normalized ||
        // Arabic spellings vary in their long vowels — تمارا and تامارا are the
        // same company — so fall back to the consonant skeleton.
        (loose.length > 1 && looseArabicKey(company.displayNameAr) === loose),
    );

    if (known) {
      setStarterMatch(known);
      setResolving(false);
      return;
    }
    const { data, error: resolveError } = await resolveCompany(trimmed);
    setResolving(false);

    if (resolveError || !data) {
      setError(resolveError ?? t('jobFeed.errors.trackFailed', 'Could not follow that company.'));
      return;
    }
    setResolution(data);
  }, [query, t]);

  const handleTrack = useCallback(
    async (candidate: ResolutionCandidate, displayName: string) => {
      setBusyCompany(candidate.token);
      const { error: trackError } = await trackCompany({
        source: candidate.source,
        token: candidate.token,
        displayName,
      });
      setBusyCompany(null);

      if (trackError) {
        setError(trackError);
        return;
      }

      setQuery('');
      setResolution(null);
      setStarterMatch(null);
      await load();
    },
    [load],
  );

  const handleStarter = useCallback(
    async (company: StarterCompany) => {
      setBusyCompany(company.token);
      const { error: trackError } = await trackCompany({
        source: company.source,
        token: company.token,
        displayName: company.displayName,
      });
      setBusyCompany(null);

      if (trackError) {
        setError(trackError);
        return;
      }

      // Clear the search and its result. Leaving them on screen after a successful
      // follow made the click look like it had done nothing — the company was
      // tracked, but the panel that prompted it was still sitting there.
      setQuery('');
      setStarterMatch(null);
      setResolution(null);
      await load();
    },
    [load],
  );

  const handleSuggestion = useCallback(
    async (name: string) => {
      setQuery(name);
      setResolving(true);
      setResolution(null);
      const { data } = await resolveCompany(name);
      setResolving(false);
      if (data) setResolution(data);
    },
    [],
  );

  const handleUntrack = useCallback(
    async (companyId: string) => {
      /*
       * Drop the row immediately and let the request catch up.
       *
       * This used to await the delete and then call load(), refetching every
       * company, posting and feed-state row to remove one line — two round trips
       * of visible lag for something the user has already decided. The row and its
       * postings disappear now; if the server refuses, both come back and the
       * error says why.
       */
      const removedCompany = companies.find((company) => company.companyId === companyId);
      const removedPostings = postings.filter((posting) => posting.companyId === companyId);

      setCompanies((previous) => previous.filter((company) => company.companyId !== companyId));
      setPostings((previous) => previous.filter((posting) => posting.companyId !== companyId));

      const { error: untrackError } = await untrackCompany(companyId);

      if (untrackError) {
        if (removedCompany) setCompanies((previous) => [...previous, removedCompany]);
        if (removedPostings.length > 0) setPostings((previous) => [...previous, ...removedPostings]);
        setError(untrackError);
      }
    },
    [companies, postings],
  );

  const handleDismiss = useCallback(async (postingId: string) => {
    setFeedStateMap((previous) => new Map(previous).set(postingId, 'dismissed'));
    await setFeedState(postingId, 'dismissed');
  }, []);

  const handleSave = useCallback(
    async (scored: ScoredPosting) => {
      const description = await getPostingDescription(scored.posting.id);
      const { error: saveError } = await createJobApplication({
        company_name: scored.posting.companyName,
        job_title: scored.posting.title,
        job_description: description,
        job_url: scored.posting.applyUrl,
        location: scored.posting.location,
        status: 'saved',
      });

      // createJobApplication returns an error rather than throwing. Hiding the row
      // regardless would lose the posting from both views at once: gone from the
      // feed, never in the pipeline.
      if (saveError) {
        setError(saveError);
        return;
      }

      setFeedStateMap((previous) => new Map(previous).set(scored.posting.id, 'saved'));
      await setFeedState(scored.posting.id, 'saved');
    },
    [],
  );

  const handleMatch = useCallback(
    async (scored: ScoredPosting) => {
      if (!onMatchPosting) return;
      const description = await getPostingDescription(scored.posting.id);
      onMatchPosting({
        jobDescription: description,
        companyName: scored.posting.companyName,
        jobTitle: scored.posting.title,
      });
    },
    [onMatchPosting],
  );

  if (loading) {
    return (
      <GlassCard className="p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">{t('jobFeed.title', 'Job feed')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('jobFeed.subtitle', 'New roles from the company boards you follow, matched against your target role.')}
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              // A result from the previous query must never sit under a new one.
              setResolution(null);
              setStarterMatch(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleResolve();
            }}
            placeholder={t('jobFeed.companies.placeholder', 'Company name or careers page link')}
            aria-label={t('jobFeed.companies.add', 'Add a company')}
            className="flex-1 min-h-12 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-gray-900 placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
          />
          <GlassButton
            variant="secondary"
            onClick={() => void handleResolve()}
            disabled={resolving || query.trim().length < 2 || companies.length >= MAX_TRACKED_COMPANIES}
          >
            {resolving ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4 me-2" aria-hidden="true" />
            )}
            {t('jobFeed.companies.addButton', 'Find their job board')}
          </GlassButton>
        </div>

        {companies.length >= MAX_TRACKED_COMPANIES && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            {t('jobFeed.companies.limitReached', { max: MAX_TRACKED_COMPANIES })}
          </p>
        )}

        {loadFailed && (
          <p className="mt-2 text-sm text-destructive">
            {t('jobFeed.errors.loadFailed', 'Could not load your feed. Try again.')}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          {starters.length > 0 && !resolution && !starterMatch && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t('jobFeed.empty.starters', 'Saudi employers we can read')}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {t('jobFeed.empty.startersHelp', 'Verified job boards. Tap one to start following it.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {starters.map((company) => (
                <button
                  key={`${company.source}:${company.token}`}
                  type="button"
                  onClick={() => void handleStarter(company)}
                  disabled={busyCompany === company.token}
                  className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-gray-900 transition-[color,border-color,background-color,scale] duration-200 hover:border-primary hover:bg-primary/5 active:scale-[0.96] disabled:opacity-60 dark:text-white"
                >
                  {language === 'ar' ? company.displayNameAr : company.displayName}
                </button>
              ))}
            </div>
          </div>
        )}


        {starterMatch && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
            <span className="flex-1 text-sm text-gray-900 dark:text-white">
              {t('jobFeed.resolve.knownCompany', { name: starterMatch.displayName })}
            </span>
            <GlassButton
              variant="secondary"
              onClick={() => void handleStarter(starterMatch)}
              disabled={busyCompany === starterMatch.token}
            >
              <Plus className="h-4 w-4 me-1" aria-hidden="true" />
              {t('jobFeed.resolve.pick', 'Follow this board')}
            </GlassButton>
          </div>
        )}

        {resolution && (
          <div className="mt-4 rounded-xl border border-border p-4">
            {resolution.candidates.length > 0 ? (
              <>
                {resolution.candidates.length > 1 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('jobFeed.resolve.multiple', 'More than one board matched. Pick the right one:')}
                  </p>
                )}
                <ul className="space-y-2">
                  {resolution.candidates.filter((candidate) => candidate.token.trim().length > 0).map((candidate) => (
                    <li key={`${candidate.source}:${candidate.token}`} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">
                        {t('jobFeed.resolve.found', {
                          source: candidate.source,
                          count: candidate.jobCount,
                        })}
                      </span>
                      <GlassButton
                        variant="secondary"
                        onClick={() => void handleTrack(candidate, query.trim() || candidate.token)}
                        disabled={busyCompany === candidate.token}
                      >
                        <Plus className="h-4 w-4 me-1" aria-hidden="true" />
                        {t('jobFeed.resolve.pick', 'Follow this board')}
                      </GlassButton>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              /* A total miss is said out loud and pointed somewhere useful — never a blank list. */
              <div className="text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{t('jobFeed.resolve.notFound', 'No public job board found for that name.')}</p>
                <p className="text-muted-foreground mt-1">
                  {/* An Arabic name cannot become an ATS handle, so the advice differs. */}
                  {/[؀-ۿ]/.test(query)
                    ? t('jobFeed.resolve.notFoundArabic', "Try the company's English name, or paste their careers page link.")
                    : t('jobFeed.resolve.notFoundHelp', 'Open their careers page and paste the link instead.')}
                </p>
              </div>
            )}
          </div>
        )}

        {companies.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {companies.map((company) => (
              <li key={company.companyId} className="flex items-center gap-3 py-3">
                <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {company.displayName}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {/* A board we have not read yet says so. Showing "0 open roles"
                      would claim the employer is not hiring, which we do not know. */}
                  {company.lastStatus === 'failed'
                    ? t('jobFeed.companies.checkFailed', 'Could not read this board last time')
                    : !company.lastFetchedAt
                      ? t('jobFeed.companies.neverChecked', 'Not checked yet')
                      : t('jobFeed.companies.openRoles', { count: company.lastJobCount })}
                </span>
                <button
                  type="button"
                  onClick={() => void handleUntrack(company.companyId)}
                  disabled={busyCompany === company.companyId}
                  aria-label={t('jobFeed.companies.remove', 'Stop following')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,scale] duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-[0.96] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Three distinct empty states — a blank list would read as broken. */}
      {companies.length === 0 && (
        <GlassCard className="p-6">
          <p className="text-base font-medium text-gray-900 dark:text-white">{t('jobFeed.empty.noCompanies', 'Follow a company to start seeing roles.')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('jobFeed.empty.noCompaniesHelp', 'Add the employers you actually want to work for.')}
          </p>
          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('jobFeed.empty.suggestions', 'From your CV')}</p>
              <p className="text-xs text-muted-foreground mb-3">
                {t('jobFeed.empty.suggestionsHelp', 'Companies you have worked at — a quick place to start.')}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => void handleSuggestion(name)}
                    className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-gray-900 transition-[color,border-color,background-color,scale] duration-200 hover:border-primary hover:bg-primary/5 active:scale-[0.96] disabled:opacity-60 dark:text-white"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {companies.length > 0 && !intent && (
        <GlassCard className="p-6">
          <p className="text-base font-medium text-gray-900 dark:text-white">{t('jobFeed.empty.noIntent', 'Set your target role first.')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('jobFeed.empty.noIntentHelp', 'The feed matches roles against what you are looking for.')}
          </p>
        </GlassCard>
      )}

      {feed && feed.kept.length === 0 && postings.length > 0 && (
        <GlassCard className="p-6">
          <p className="text-base font-medium text-gray-900 dark:text-white">{t('jobFeed.empty.allFiltered', 'Nothing matched today.')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('jobFeed.empty.allFilteredHelp', { count: feed.dropped.length })}
          </p>
        </GlassCard>
      )}

      {feed?.kept.map((scored, index) => {
        const trackedSince = trackedSinceById.get(scored.posting.companyId) ?? scored.posting.firstSeenAt;
        const fresh = isNew(scored.posting, trackedSince, lastSeenAt);
        const matchPercent = Math.round((scored.score / maxScore) * 100);
        const scoreTone =
          matchPercent >= 90
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
            : matchPercent >= 70
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
              : 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200';

        return (
          /* Rows arrive together after an async load, so they are staggered rather
             than appearing as one block. Capped so a long feed does not crawl in. */
          <m.div
            key={scored.posting.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0, delay: Math.min(index, 6) * 0.04 }}
          >
          <GlassCard className="p-4">
            <div className="flex items-start gap-4">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold tabular-nums ${scoreTone}`}
                title={t('jobFeed.why.label', 'Why this is here')}
              >
                {matchPercent}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold leading-snug text-gray-900 dark:text-white">
                    {scored.posting.title}
                  </h3>
                  {fresh && (
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary">
                      {t('jobFeed.newBadge', 'New')}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{scored.posting.companyName}</span>
                  {' · '}
                  {scored.posting.location}
                </p>
                {scored.matched.length > 0 && (
                  /* Deterministic, non-AI reason. Never a model's opinion dressed as one. */
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('jobFeed.why.matched', { terms: scored.matched.join(', ') })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDismiss(scored.posting.id)}
                aria-label={t('jobFeed.actions.dismiss', 'Not interested')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color,scale] duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-[0.96]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Routes into the sections that already own this work. Nothing here
                changes the CV on its own. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {onMatchPosting && (
                <GlassButton variant="secondary" onClick={() => void handleMatch(scored)}>
                  {t('jobFeed.actions.match', 'Check the match')}
                </GlassButton>
              )}
              <GlassButton variant="secondary" onClick={() => void handleSave(scored)}>
                {t('jobFeed.actions.save', 'Save to pipeline')}
              </GlassButton>
              <a
                href={scored.posting.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary transition-[color,background-color] duration-200 hover:bg-primary/10 hover:underline"
              >
                {t('jobFeed.actions.apply', 'View posting')}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </GlassCard>
          </m.div>
        );
      })}
    </div>
  );
}

export default JobFeedSection;
