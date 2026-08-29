// Shared shapes for the ATS readers. Every provider normalizes to `RawPosting`
// so the crawler and the probe never branch on source.

export type AtsSource =
  | 'greenhouse'
  | 'ashby'
  | 'workable'
  | 'lever'
  | 'pinpoint'
  | 'workday'
  | 'jsonld';

export interface RawPosting {
  externalId: string;
  title: string;
  location: string;
  applyUrl: string;
  /** ISO date, or null when the board publishes none (Pinpoint, Workday). */
  postedAt: string | null;
  /** Empty when the board does not ship it in the list payload — fetched lazily. */
  description: string;
}

/**
 * The result of reading one board.
 *
 * `ok` means the fetch explicitly succeeded: HTTP 200 and a parsed payload. It is
 * the ONLY signal allowed to drive closure reconciliation. A failed fetch also
 * returns zero postings, and treating that as "the board is empty" would let one
 * transient 502 mark every posting of a company closed.
 */
export interface FetchOutcome {
  ok: boolean;
  status: number | null;
  postings: RawPosting[];
  error?: string;
}

export interface CompanyRef {
  source: AtsSource;
  /** Provider-specific handle. Workday packs `tenant:host:site`; jsonld uses the careers URL. */
  token: string;
  name?: string;
}

export interface ProbeResult {
  found: boolean;
  count: number;
}

export interface AtsProvider {
  source: AtsSource;
  /**
   * Whether a successful fetch's absence of a posting can be believed as closure.
   *
   * A board API returning an empty array means the board is empty. A careers page
   * returning no structured data usually means a layout change or a bot wall, so
   * the jsonld reader is 'untrusted' and the crawler never closes from it.
   * Omitted means trusted.
   */
  closureSignal?: 'trusted' | 'untrusted';
  /** Reject anything that cannot be a token for this provider before it reaches a URL. */
  isValidToken(token: string): boolean;
  fetchPostings(ref: CompanyRef): Promise<FetchOutcome>;
  probe(token: string): Promise<ProbeResult>;
  /** Only for providers whose list payload omits descriptions. */
  fetchDescription?(ref: CompanyRef, posting: RawPosting): Promise<string>;
}
