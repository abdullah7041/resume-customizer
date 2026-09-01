import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, Plus, RotateCw, Trash2, X } from 'lucide-react';
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
import { bestRoleCoverage, buildFeed, isNew } from '@/lib/jobs/score';
import { lastBoardCheck } from '@/lib/jobs/boardFreshness';
import { DEFAULT_MAX_AGE_DAYS, postingAge } from '@/lib/jobs/age';
import { looseArabicKey, normalizeText } from '@/lib/jobs/normalize';
import {
  partitionStarters,
  SAUDI_STARTER_COMPANIES,
  unfollowedStarters,
  type StarterCompany,
} from '@/lib/jobs/saudiStarterCompanies';
import type { FeedIntent, FeedPosting, ScoredPosting } from '@/lib/jobs/types';

const MAX_TRACKED_COMPANIES = 25;

/** How many company chips fit before the row is collapsed behind a "show all". */
const COLLAPSED_COMPANY_CHIPS = 8;

/**
 * The age windows offered, in days. `null` is "any time".
 *
 * A one-week default is what makes the feed read as current, but it cannot be a
 * hard rule: half the boards publish no posting date at all, so the window only
 * ever tests a real one (see `age.ts`), and this control exists so a user who
 * finds the week too narrow can widen it rather than conclude the feed is empty.
 */
const AGE_OPTIONS: { days: number | null; key: string; fallback: string }[] = [
  { days: 1, key: 'jobFeed.filters.ageDay', fallback: '24 hours' },
  { days: DEFAULT_MAX_AGE_DAYS, key: 'jobFeed.filters.ageWeek', fallback: '7 days' },
  { days: 30, key: 'jobFeed.filters.ageMonth', fallback: '30 days' },
  { days: null, key: 'jobFeed.filters.ageAll', fallback: 'Any time' },
];

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

  /**
   * A refresh must not blank the page.
   *
   * `loading` swaps the whole section for a spinner card, which is right on first
   * mount and wrong for every reload after it — a user who presses Refresh would
   * watch their feed disappear and come back. The first load owns `loading`;
   * everything after it owns this.
   */
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  /**
   * A ticking clock, so relative times stay true.
   *
   * "Updated just now" that still says "just now" an hour later is the same class
   * of lie as a first-seen date labelled as a posting date. One minute is finer
   * than any label here needs, and it re-ages the feed as postings cross the
   * window boundary.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(DEFAULT_MAX_AGE_DAYS);
  /** Once the user picks a window themselves, nothing widens it behind their back. */
  const [ageChosenByUser, setAgeChosenByUser] = useState(false);
  const [autoWidened, setAutoWidened] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [showAllCompanyChips, setShowAllCompanyChips] = useState(false);
  /**
   * Whether the chips are showing their unfollow controls.
   *
   * Unfollowing costs a re-crawl to undo — the postings go with the company — so
   * it does not sit one mis-tap away from the filter it shares a chip with.
   */
  const [managingCompanies, setManagingCompanies] = useState(false);

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
  /** Where focus lands when the chip a keyboard user was standing on is removed. */
  const manageButtonRef = useRef<HTMLButtonElement>(null);

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

  /**
   * Boards that had roles when we last read them, and boards that did not.
   *
   * Seven of the thirteen starters are real, readable accounts with nothing
   * posted. Offered in the same row under "tap one to start following it", they
   * send a first-time user to a wait and then an empty feed, which reads as a
   * broken feature rather than a company being watched. Split, they read as what
   * they are: one group to follow for roles, one to follow for news of roles.
   */
  const { hiring: hiringStarters, quiet: quietStarters } = useMemo(
    () => partitionStarters(starters),
    [starters],
  );

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setLoadFailed(false);

    // A load that failed has not updated anything, so it must not stamp the
    // clock — "Updated just now" beside "Could not load your feed" is a lie the
    // user has no way to see through.
    const finish = (ok: boolean) => {
      setLoading(false);
      setRefreshing(false);
      if (ok) setLastLoadedAt(Date.now());
    };

    const { companies: tracked, error: companiesError } = await listTrackedCompanies();
    if (companiesError) {
      setLoadFailed(true);
      finish(false);
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
    // A company filter that outlives the company it names silently empties the
    // feed, so selections are pruned against whatever is still followed.
    const trackedIds = new Set(tracked.map((company) => company.companyId));
    setSelectedCompanyIds((previous) => {
      const next = new Set([...previous].filter((id) => trackedIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
    finish(!postingsError);
  }, []);

  const handleRefresh = useCallback(() => {
    void load({ silent: true });
  }, [load]);

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
   * The whole feed, before the company filter.
   *
   * The company selection is applied to the result rather than to the input, so
   * one build answers both questions the view asks: which rows to show, and how
   * many rows each chip stands for. Filtering first made the chip counts collapse
   * to the selected company the moment anything was selected, and put drops from
   * companies the user had filtered out into `dropped`, which is what the empty
   * states read to name the rule that emptied the feed.
   */
  const feed = useMemo(() => {
    if (!intent) return null;
    const visible = postings.filter((posting) => !feedState.has(posting.id));
    return buildFeed(visible, intent, { maxAgeDays: maxAgeDays ?? undefined, now });
  }, [postings, feedState, intent, maxAgeDays, now]);

  const visibleKept = useMemo(() => {
    if (!feed) return [];
    if (selectedCompanyIds.size === 0) return feed.kept;
    return feed.kept.filter((scored) => selectedCompanyIds.has(scored.posting.companyId));
  }, [feed, selectedCompanyIds]);

  /**
   * How many roles each chip actually stands for.
   *
   * The crawl's `lastJobCount` is every row on the board — 27 for Salla — while
   * the feed shows the handful that clear the location, level, role and age
   * rules. A chip reading 27 above a list of seven is the feed telling the user
   * it is hiding something, so the chip counts what it can show.
   */
  const matchCountByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scored of feed?.kept ?? []) {
      counts.set(scored.posting.companyId, (counts.get(scored.posting.companyId) ?? 0) + 1);
    }
    return counts;
  }, [feed]);

  /**
   * Role coverage for the rows on screen, computed once per feed.
   *
   * `bestRoleCoverage` re-derives every target role's terms — normalizing, splitting
   * and scanning the stopword lists — so calling it inside the row map re-did that
   * work for every row on every render, and the one-minute clock re-renders the
   * whole feed for input that has not changed.
   */
  const coverageByPosting = useMemo(() => {
    const coverage = new Map<string, ReturnType<typeof bestRoleCoverage>>();
    if (!intent) return coverage;
    for (const scored of visibleKept) {
      coverage.set(scored.posting.id, bestRoleCoverage(scored.posting.title, intent.targetRoles));
    }
    return coverage;
  }, [visibleKept, intent]);

  /** When the boards themselves were last read — not when this page last re-read them. */
  const boardsCheckedAt = useMemo(() => lastBoardCheck(companies), [companies]);

  /**
   * What was rejected among the companies the user is actually looking at.
   *
   * The empty states name the rule that emptied the feed, so they have to be
   * scoped the same way the rows are. Reading the whole feed's drops under a
   * one-company filter blamed the age window for a backlog at a company the user
   * had just filtered out.
   */
  const visibleDropped = useMemo(() => {
    if (!feed) return [];
    if (selectedCompanyIds.size === 0) return feed.dropped;
    return feed.dropped.filter((entry) => selectedCompanyIds.has(entry.posting.companyId));
  }, [feed, selectedCompanyIds]);

  /** How many matching roles the age window alone is holding back. */
  const agedOut = useMemo(
    () => visibleDropped.filter((entry) => entry.reason === 'age').length,
    [visibleDropped],
  );

  /**
   * Widen the window once rather than open on an empty feed.
   *
   * Measured against the live starter boards on 2026-08-31: Careem had 20 open
   * roles and none posted in the last seven days; HALA 4 of 16, Tamara 3 of 36,
   * Salla 3 of 27, Lean 1 of 4. So a hard seven-day default shows a first-time
   * follower of one company nothing at all, which reads as a broken feature
   * rather than a narrow filter. A week stays the default because it is the
   * honest answer when there is one; when there is not, the feed widens itself
   * once and says so, and the user's own choice is never overridden.
   */
  useEffect(() => {
    if (ageChosenByUser || autoWidened) return;
    // Widening changes the window for every company. Doing it because a company
    // filter emptied the view announces "nothing was posted in the last week"
    // about a feed that was showing this week's roles until the user narrowed it.
    // An emptied filter has its own way out; only an empty feed earns this one.
    if (selectedCompanyIds.size > 0) return;
    if (!feed || visibleKept.length > 0 || agedOut === 0) return;
    setMaxAgeDays(30);
    setAutoWidened(true);
  }, [feed, visibleKept, agedOut, selectedCompanyIds, ageChosenByUser, autoWidened]);

  const chooseAge = useCallback((days: number | null) => {
    setAgeChosenByUser(true);
    setMaxAgeDays(days);
  }, []);

  /**
   * Relative times in the user's own language.
   *
   * `Intl.RelativeTimeFormat` already knows that Arabic has six plural forms and
   * that zero days ago is "today", so none of that is re-encoded as translation
   * keys that would then have to be kept in step with it.
   */
  const relativeTime = useMemo(() => {
    try {
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    } catch {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    }
  }, [language]);

  const formatSince = useCallback(
    (from: number) => {
      const minutes = Math.floor((now - from) / 60_000);
      if (minutes < 1) return t('jobFeed.lastUpdated.justNow', 'just now');
      if (minutes < 60) return relativeTime.format(-minutes, 'minute');
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return relativeTime.format(-hours, 'hour');
      return relativeTime.format(-Math.floor(hours / 24), 'day');
    },
    [now, relativeTime, t],
  );

  const toggleCompanyFilter = useCallback((companyId: string) => {
    setSelectedCompanyIds((previous) => {
      const next = new Set(previous);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  }, []);

  const visibleCompanyChips = useMemo(
    () => (showAllCompanyChips ? companies : companies.slice(0, COLLAPSED_COMPANY_CHIPS)),
    [companies, showAllCompanyChips],
  );

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
      await load({ silent: true });
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
      await load({ silent: true });
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
      setSelectedCompanyIds((previous) => {
        if (!previous.has(companyId)) return previous;
        const next = new Set(previous);
        next.delete(companyId);
        return next;
      });

      // The control the user was standing on has just unmounted. Without this,
      // focus falls to <body> and the tab order restarts at the top of the page.
      manageButtonRef.current?.focus();

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
              <Plus className="h-4 w-4 me-2" aria-hidden="true" />
            )}
            {t('jobFeed.companies.addButton', 'Add company')}
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
          <div className="mt-4 space-y-4">
            {hiringStarters.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('jobFeed.empty.starters', 'Saudi employers we can read')}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('jobFeed.empty.startersHelp', 'Verified job boards. Tap one to start following it.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {hiringStarters.map((company) => (
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

            {/* Real accounts with nothing posted. Following one is how you hear
                when that changes — but it must not be sold as roles waiting. */}
            {quietStarters.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('jobFeed.empty.startersQuiet', 'Readable boards with nothing posted')}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('jobFeed.empty.startersQuietHelp', 'Their boards read fine and were empty when we last checked. Follow one to hear the moment it posts.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quietStarters.map((company) => (
                    <button
                      key={`${company.source}:${company.token}`}
                      type="button"
                      onClick={() => void handleStarter(company)}
                      disabled={busyCompany === company.token}
                      className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-border px-4 text-sm font-medium text-muted-foreground transition-[color,border-color,background-color,scale] duration-200 hover:border-primary hover:bg-primary/5 hover:text-gray-900 active:scale-[0.96] disabled:opacity-60 dark:hover:text-white"
                    >
                      {language === 'ar' ? company.displayNameAr : company.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

        {/* The followed companies are not listed twice. The chip row below owns
            them: it is the one that filters, and it now carries the count, the
            board status and — behind Manage — the unfollow. */}
      </GlassCard>

      {companies.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                title={t('jobFeed.lastUpdated.explain', 'Re-reads what the last board check found.')}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-gray-900 transition-[color,border-color,background-color,scale] duration-200 hover:border-primary hover:bg-primary/5 active:scale-[0.96] disabled:opacity-60 dark:text-white"
              >
                <RotateCw
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {refreshing
                  ? t('jobFeed.lastUpdated.refreshing', 'Reloading…')
                  : t('jobFeed.lastUpdated.action', 'Reload')}
              </button>
              {/* Two clocks, because they answer different questions. This button
                  re-reads what the last crawl stored; it does not go to the boards
                  and cannot — the crawl is a secret-gated background function on a
                  daily schedule. "Updated 2 minutes ago" beside a feed whose boards
                  were last read yesterday reads as freshness it does not have. */}
              <div className="flex flex-col text-xs text-muted-foreground">
                {lastLoadedAt !== null && (
                  <span>
                    {t('jobFeed.lastUpdated.label', {
                      when: formatSince(lastLoadedAt),
                      defaultValue: 'Updated {{when}}',
                    })}
                  </span>
                )}
                {boardsCheckedAt !== null && (
                  <span>
                    {t('jobFeed.lastUpdated.boards', {
                      when: formatSince(boardsCheckedAt),
                      defaultValue: 'Boards last checked {{when}}',
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t('jobFeed.filters.ageLegend', 'Posted within')}
              </span>
              {/* Outer radius = inner radius + padding, so the pills sit concentric. */}
              <div className="inline-flex gap-1 rounded-[1.375rem] border border-border p-1">
                {AGE_OPTIONS.map((option) => {
                  const active = maxAgeDays === option.days;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseAge(option.days)}
                      className={`inline-flex min-h-10 items-center rounded-2xl px-3 text-xs font-medium transition-[color,background-color,scale] duration-200 active:scale-[0.96] ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-primary/5 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {t(option.key, option.fallback)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {autoWidened && !ageChosenByUser && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('jobFeed.filters.widened', 'Nothing was posted in the last week, so this is the last 30 days.')}
            </p>
          )}

          {/* The row exists whenever a company is followed — it is the only place
              a company is shown, so a single follow still needs it. */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {/* The "All" pill is the part that is only a filter, and a filter
                  with one option is not a filter, so it starts at two. */}
              {companies.length > 1 && (
              <button
                type="button"
                aria-pressed={selectedCompanyIds.size === 0}
                aria-label={t('jobFeed.filters.companyAllLabel', 'Show roles from every company')}
                onClick={() => setSelectedCompanyIds(new Set())}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-[color,border-color,background-color,scale] duration-200 active:scale-[0.96] ${
                  selectedCompanyIds.size === 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-gray-900 hover:border-primary hover:bg-primary/5 dark:text-white'
                }`}
              >
                {t('jobFeed.filters.companyAll', 'All')}
              </button>
              )}

              {visibleCompanyChips.map((company) => {
                const active = selectedCompanyIds.has(company.companyId);
                return (
                  /* Two sibling buttons under one shell, never one inside the
                     other: a filter that contains a delete is invalid HTML and
                     gives a screen reader one control where there are two. */
                  <div
                    key={company.companyId}
                    role="group"
                    aria-label={company.displayName}
                    className={`inline-flex min-h-10 items-center rounded-full border text-sm font-medium transition-[color,border-color,background-color] duration-200 ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-gray-900 hover:border-primary hover:bg-primary/5 dark:text-white'
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={t('jobFeed.filters.companySelect', {
                        name: company.displayName,
                        defaultValue: 'Show only {{name}}',
                      })}
                      onClick={() => toggleCompanyFilter(company.companyId)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full ps-1.5 pe-2 text-inherit transition-[scale] duration-200 active:scale-[0.96]"
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold uppercase ${
                          active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {company.displayName.trim().charAt(0) || '?'}
                      </span>
                      <span className="max-w-[10rem] truncate">{company.displayName}</span>
                    </button>

                    {/* Outside the filter button on purpose. An accessible name
                        computation stops at that button's own aria-label and never
                        reaches its descendants, so a status nested inside it is
                        drawn and never announced — and the list this replaced said
                        these states out loud. Non-interactive, so it belongs in the
                        group rather than in either control.

                        What is counted is what the feed can show; the board's own
                        total is the denominator in the label, and the two come from
                        different windows — the count respects the age filter, the
                        total is every open role the last crawl saw. */}
                    {company.lastStatus === 'failed' ? (
                      <span
                        role="img"
                        aria-label={t('jobFeed.companies.checkFailed', 'Could not read this board last time')}
                        title={t('jobFeed.companies.checkFailed', 'Could not read this board last time')}
                        className="me-3 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                      />
                    ) : company.lastFetchedAt ? (
                      <span
                        className="me-3 text-xs tabular-nums text-muted-foreground"
                        aria-label={t('jobFeed.companies.matchingOf', {
                          matching: matchCountByCompany.get(company.companyId) ?? 0,
                          total: company.lastJobCount,
                          defaultValue: '{{matching}} of {{total}} open roles match your search',
                        })}
                        title={t('jobFeed.companies.matchingOf', {
                          matching: matchCountByCompany.get(company.companyId) ?? 0,
                          total: company.lastJobCount,
                          defaultValue: '{{matching}} of {{total}} open roles match your search',
                        })}
                      >
                        {matchCountByCompany.get(company.companyId) ?? 0}
                      </span>
                    ) : (
                      <span
                        role="img"
                        aria-label={t('jobFeed.companies.neverChecked', 'Not checked yet')}
                        title={t('jobFeed.companies.neverChecked', 'Not checked yet')}
                        className="me-3 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                      />
                    )}

                    {managingCompanies && (
                      <button
                        type="button"
                        onClick={() => void handleUntrack(company.companyId)}
                        disabled={busyCompany === company.companyId}
                        aria-label={t('jobFeed.companies.remove', 'Stop following')}
                        className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-e-full text-muted-foreground transition-[color,background-color,scale] duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-[0.96] disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                ref={manageButtonRef}
                aria-pressed={managingCompanies}
                onClick={() => setManagingCompanies((previous) => !previous)}
                className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-[color,background-color,scale] duration-200 hover:bg-primary/10 hover:text-primary active:scale-[0.96]"
              >
                {managingCompanies
                  ? t('jobFeed.filters.manageDone', 'Done')
                  : t('jobFeed.filters.manage', 'Manage companies')}
              </button>

              {companies.length > COLLAPSED_COMPANY_CHIPS && (
                <button
                  type="button"
                  onClick={() => setShowAllCompanyChips((previous) => !previous)}
                  className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-primary transition-[color,background-color,scale] duration-200 hover:bg-primary/10 active:scale-[0.96]"
                >
                  {showAllCompanyChips
                    ? t('jobFeed.filters.showLess', 'Show fewer companies')
                    : t('jobFeed.filters.showMore', {
                        total: companies.length,
                        defaultValue: 'Show all {{total}} companies',
                      })}
                </button>
              )}
          </div>
        </GlassCard>
      )}

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

      {/* An empty feed always names the rule that emptied it. The age window gets
          its own wording and its own way out, because it is the one rule the user
          just chose and can undo in a click. */}
      {feed && visibleKept.length === 0 && postings.length > 0 && (
        <GlassCard className="p-6">
          {/* Asked in order of how much the user can do about it. The age window
              is theirs to widen in one click, and `agedOut` counts only the
              companies they are looking at, so it never blames a filtered-out
              company's backlog. The company filter comes next: it is the other
              rule they applied themselves, so "nothing matched" would be
              answering a question they did not ask. */}
          {agedOut > 0 ? (
            <>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {t('jobFeed.empty.allFilteredAge', 'Nothing posted in that window.')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobFeed.empty.allFilteredAgeHelp', {
                  total: agedOut,
                  defaultValue: '{{total}} matching roles are older than the window you picked.',
                })}
              </p>
              <GlassButton variant="secondary" className="mt-4" onClick={() => chooseAge(null)}>
                {t('jobFeed.empty.showOlder', 'Show older roles')}
              </GlassButton>
            </>
          ) : feed.kept.length > 0 ? (
            /* Nothing was rejected here — the user narrowed the question. "0 roles
               were checked and none cleared your filters" would be false twice. */
            <>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {t('jobFeed.empty.allFilteredCompany', 'No open roles from the companies you picked.')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobFeed.empty.allFilteredCompanyHelp', 'Other followed companies may still have something.')}
              </p>
              <GlassButton variant="secondary" className="mt-4" onClick={() => setSelectedCompanyIds(new Set())}>
                {t('jobFeed.empty.showAllCompanies', 'Show all companies')}
              </GlassButton>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-gray-900 dark:text-white">{t('jobFeed.empty.allFiltered', 'Nothing matched today.')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobFeed.empty.allFilteredHelp', { count: visibleDropped.length })}
              </p>
            </>
          )}
        </GlassCard>
      )}

      {visibleKept.map((scored, index) => {
        const trackedSince = trackedSinceById.get(scored.posting.companyId) ?? scored.posting.firstSeenAt;
        const fresh = isNew(scored.posting, trackedSince, lastSeenAt);
        const age = postingAge(scored.posting, now);
        const dated = age.kind === 'posted';
        /**
         * How much of one target role the title covers — never a percentage.
         *
         * A 0-100 number beside a job is read as the match score, and this is not
         * one: it is title keyword overlap, computed in the browser without ever
         * reading the job description or the CV, so it sat next to the Match tab's
         * AI score claiming to be the same quantity and disagreeing with it. Two
         * numbers out of two terms is a claim this can actually support.
         */
        const coverage = coverageByPosting.get(scored.posting.id) ?? null;
        const complete = coverage !== null && coverage.matched.length === coverage.total;

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
              {coverage && (
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums ${
                    complete ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                  title={t('jobFeed.why.coverageHint', {
                    role: coverage.role,
                    defaultValue: 'Words from your target role "{{role}}" that this title uses',
                  })}
                  aria-label={t('jobFeed.why.coverage', {
                    matched: coverage.matched.length,
                    total: coverage.total,
                    role: coverage.role,
                    defaultValue: '{{matched}} of {{total}} words from your target role {{role}}',
                  })}
                >
                  {`${coverage.matched.length}/${coverage.total}`}
                </span>
              )}
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
                  {/* "Posted" and "First seen" are deliberately different words. Half
                      the boards publish no posting date, and our first sighting of a
                      role is not a claim about when the employer put it up. An
                      unreadable date shows nothing rather than inventing "today". */}
                  {age.kind !== 'unknown' && (
                  <>
                  {' · '}
                  <time
                    dateTime={age.iso ?? undefined}
                    title={dated ? undefined : t('jobFeed.date.seenHint', 'This job board does not publish posting dates.')}
                    className={dated ? undefined : 'underline decoration-dotted underline-offset-2'}
                  >
                    {dated
                      ? t('jobFeed.date.posted', {
                          when: relativeTime.format(-age.days, 'day'),
                          defaultValue: 'Posted {{when}}',
                        })
                      : t('jobFeed.date.seen', {
                          when: relativeTime.format(-age.days, 'day'),
                          defaultValue: 'First seen {{when}}',
                        })}
                  </time>
                  </>
                  )}
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
