import type { Handler } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const STOPWORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "with",
  "would",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

type MatchScoreBody = {
  resumeText?: string;
  resumeFileId?: string;
  jobDesc?: string;
};

const normalize = (input: string): string[] => {
  const lowered = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    lowered
      .match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)?.filter((token) => !STOPWORDS.has(token)) ?? []
  );
};

const termFrequency = (tokens: string[]): Map<string, number> => {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
};

const inverseDocumentFrequency = (documents: string[][]): Map<string, number> => {
  const docCount = documents.length;
  const idf = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      idf.set(token, (idf.get(token) ?? 0) + 1);
    }
  }

  for (const [token, count] of idf.entries()) {
    const score = Math.log((docCount + 1) / (count + 1)) + 1;
    idf.set(token, score);
  }

  return idf;
};

const buildVector = (
  tf: Map<string, number>,
  idf: Map<string, number>,
  vocabulary: Set<string>,
): Map<string, number> => {
  const vector = new Map<string, number>();
  for (const term of vocabulary) {
    const tfValue = tf.get(term) ?? 0;
    const idfValue = idf.get(term) ?? 0;
    vector.set(term, tfValue * idfValue);
  }
  return vector;
};

const cosineSimilarity = (a: Map<string, number>, b: Map<string, number>): number => {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const value of a.values()) {
    magA += value * value;
  }

  for (const value of b.values()) {
    magB += value * value;
  }

  const iterator = a.size > b.size ? b.keys() : a.keys();
  for (const key of iterator) {
    dot += (a.get(key) ?? 0) * (b.get(key) ?? 0);
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const uniqueKeywords = (tokens: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
};

const topKeywords = (tokens: string[], limit = 25): string[] => {
  const tf = termFrequency(tokens);
  const sorted = Array.from(tf.entries())
    .filter(([token]) => token.length >= 3)
    .sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([token]) => token);
};

let cachedSupabase: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient | null => {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

const fetchResumeText = async (resumeText: string | undefined, resumeFileId: string | undefined) => {
  if (resumeText && resumeText.trim().length > 0) {
    return resumeText;
  }

  if (!resumeFileId) {
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase credentials are not configured");
  }

  const { data, error } = await supabase.storage.from("resumes").download(resumeFileId);
  if (error) {
    throw error;
  }

  const text = await data.text();
  return text;
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body: MatchScoreBody = event.body ? JSON.parse(event.body) : {};
    const { resumeText: inputResume, resumeFileId, jobDesc } = body;

    if (!jobDesc || jobDesc.trim().length === 0) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Job description is required" }),
      };
    }

    const resumeSource = await fetchResumeText(inputResume, resumeFileId);

    if (!resumeSource || resumeSource.trim().length === 0) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Resume text is required" }),
      };
    }

    const resumeTokens = normalize(resumeSource);
    const jobTokens = normalize(jobDesc);

    const idf = inverseDocumentFrequency([resumeTokens, jobTokens]);
    const vocab = new Set([...resumeTokens, ...jobTokens]);

    const resumeVector = buildVector(termFrequency(resumeTokens), idf, vocab);
    const jobVector = buildVector(termFrequency(jobTokens), idf, vocab);

    const cosine = Number(cosineSimilarity(resumeVector, jobVector).toFixed(4));

    const keywords = topKeywords(jobTokens, 25);
    const resumeKeywordSet = new Set(uniqueKeywords(resumeTokens));

    const hits = keywords.filter((keyword) => resumeKeywordSet.has(keyword));
    const missing = keywords.filter((keyword) => !resumeKeywordSet.has(keyword));

    const coverage = keywords.length === 0 ? 0 : hits.length / keywords.length;

    // Calculate base score with weighted formula: 70% cosine similarity + 30% keyword coverage
    let rawScore = 0.7 * 100 * cosine + 0.3 * 100 * coverage;
    
    // Ensure non-zero score for valid content: if both inputs have content and some overlap exists,
    // guarantee a minimum score of 5 to indicate some matching exists
    if (resumeTokens.length > 0 && jobTokens.length > 0 && (cosine > 0 || coverage > 0)) {
      rawScore = Math.max(rawScore, 5);
    }
    
    const score = Math.round(clamp(rawScore, 0, 100));

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        score,
        coverage: Number(coverage.toFixed(4)),
        similarity: cosine,
        missing_keywords: missing.slice(0, 12),
        matched_keywords: hits.slice(0, 12),
      }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to compute match score";
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
