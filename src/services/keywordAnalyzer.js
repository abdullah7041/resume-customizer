// src/services/keywordAnalyzer.js
// Keyword density analysis and TF-IDF extraction for resume optimization

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "might", "more", "most", "must", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same",
  "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves"
]);

const GENERIC_TERMS = new Set([
  "candidate", "company", "description", "job", "opportunity", "position",
  "profile", "resume", "role", "work",
  "responsibilities", "duties", "tasks", "perform", "ensure", "provide", "support", "assist",
  "including", "required", "preferred", "ability", "strong", "excellent", "good", "effective",
  "various", "multiple", "related", "appropriate", "etc", "years", "months"
]);

// Technical skills and domain-specific terms that should be prioritized
const TECHNICAL_INDICATORS = new Set([
  "api", "database", "framework", "cloud", "devops", "backend", "frontend", "fullstack",
  "programming", "development", "engineering", "architecture", "infrastructure", "deployment",
  "testing", "debugging", "optimization", "security", "authentication", "authorization",
  "ci", "cd", "agile", "scrum", "kanban", "methodology", "design", "ux", "ui",
  "algorithm", "data", "analytics", "machine", "learning", "artificial", "intelligence",
  "automation", "integration", "migration", "scalability", "performance", "monitoring"
]);

/**
 * Check if a term is likely a technical skill or important keyword
 * @param {string} term - Token to evaluate
 * @returns {boolean} True if term should be prioritized
 */
const isPriorityTerm = (term) => {
  // Prioritize longer terms (likely compound skills or specific technologies)
  if (term.length >= 6) return true;

  // Check if it's a known technical indicator
  if (TECHNICAL_INDICATORS.has(term)) return true;

  // Check for common tech patterns (e.g., "js", "py", "ml", "ai")
  if (/^[a-z]{2,4}$/.test(term) && !STOPWORDS.has(term)) {
    return true;
  }

  return false;
};

/**
 * Tokenize text into normalized lowercase words
 * @param {string} text - Input text
 * @returns {string[]} Array of tokens
 */
export const tokenize = (text) => {
  if (!text || typeof text !== "string") return [];

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !STOPWORDS.has(token) && token.length > 2) || [];
};

/**
 * Calculate term frequency (TF) for tokens
 * @param {string[]} tokens - Array of tokens
 * @returns {Map<string, number>} Map of term -> frequency
 */
export const calculateTermFrequency = (tokens) => {
  const frequency = new Map();

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  return frequency;
};

/**
 * Calculate TF-IDF scores for keywords
 * @param {string} resumeText - Resume text
 * @param {string} jobText - Job description text
 * @returns {Object} TF-IDF analysis
 */
export const calculateTFIDF = (resumeText, jobText) => {
  const resumeTokens = tokenize(resumeText);
  const jobTokens = tokenize(jobText);

  if (resumeTokens.length === 0 || jobTokens.length === 0) {
    return {
      resumeKeywords: [],
      jobKeywords: [],
      matchedKeywords: [],
      missingKeywords: [],
      overallMatch: 0
    };
  }

  const resumeFreq = calculateTermFrequency(resumeTokens);
  const jobFreq = calculateTermFrequency(jobTokens);

  // Calculate term frequency scores with priority weighting
  const resumeScores = new Map();
  const maxResumeFreq = Math.max(...resumeFreq.values());

  for (const [term, freq] of resumeFreq) {
    if (!GENERIC_TERMS.has(term)) {
      let score = freq / maxResumeFreq;
      // Boost priority terms (technical skills, longer compound words)
      if (isPriorityTerm(term)) {
        score *= 1.5;
      }
      resumeScores.set(term, score);
    }
  }

  const jobScores = new Map();
  const maxJobFreq = Math.max(...jobFreq.values());

  for (const [term, freq] of jobFreq) {
    if (!GENERIC_TERMS.has(term)) {
      let score = freq / maxJobFreq;
      // Boost priority terms
      if (isPriorityTerm(term)) {
        score *= 1.5;
      }
      jobScores.set(term, score);
    }
  }

  // Get top keywords
  const resumeKeywords = Array.from(resumeScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, score]) => ({
      term,
      count: resumeFreq.get(term) || 0,
      score: Math.round(score * 100)
    }));

  const jobKeywords = Array.from(jobScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, score]) => ({
      term,
      count: jobFreq.get(term) || 0,
      score: Math.round(score * 100)
    }));

  // Find matched and missing keywords
  const resumeTermSet = new Set(resumeScores.keys());

  const matchedKeywords = jobKeywords
    .filter(kw => resumeTermSet.has(kw.term))
    .map(kw => ({
      ...kw,
      resumeCount: resumeFreq.get(kw.term) || 0
    }));

  const missingKeywords = jobKeywords
    .filter(kw => !resumeTermSet.has(kw.term))
    .slice(0, 15); // Top 15 missing keywords

  // Calculate overall match percentage
  const overallMatch = jobKeywords.length > 0
    ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
    : 0;

  return {
    resumeKeywords,
    jobKeywords,
    matchedKeywords,
    missingKeywords,
    overallMatch
  };
};

/**
 * Analyze keyword density for a given text
 * @param {string} text - Input text
 * @param {number} topN - Number of top keywords to return
 * @returns {Object} Keyword density analysis
 */
export const analyzeKeywordDensity = (text, topN = 10) => {
  if (!text || typeof text !== "string") {
    return {
      keywords: [],
      totalWords: 0,
      uniqueWords: 0
    };
  }

  const tokens = tokenize(text);
  const frequency = calculateTermFrequency(tokens);

  // Filter out generic terms and calculate density
  const keywords = Array.from(frequency.entries())
    .filter(([term]) => !GENERIC_TERMS.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({
      term,
      count,
      density: ((count / tokens.length) * 100).toFixed(2)
    }));

  return {
    keywords,
    totalWords: tokens.length,
    uniqueWords: frequency.size
  };
};

/**
 * Suggest keywords to add/remove based on job description
 * @param {string} resumeText - Resume text
 * @param {string} jobText - Job description text
 * @returns {Object} Keyword suggestions
 */
export const suggestKeywordChanges = (resumeText, jobText) => {
  const analysis = calculateTFIDF(resumeText, jobText);

  // Keywords to add (high-value missing keywords)
  const toAdd = analysis.missingKeywords
    .filter(kw => kw.score >= 15) // Moderate importance in job description
    .slice(0, 10)
    .map(kw => ({
      term: kw.term,
      reason: `Appears ${kw.count}x in job description (${kw.score}% importance)`,
      priority: kw.score >= 80 ? "high" : "medium"
    }));

  // Keywords that are well-represented
  const wellRepresented = analysis.matchedKeywords
    .filter(kw => kw.resumeCount >= kw.count) // Resume mentions >= job mentions
    .map(kw => ({
      term: kw.term,
      jobCount: kw.count,
      resumeCount: kw.resumeCount
    }));

  // Keywords that need more emphasis
  const needEmphasis = analysis.matchedKeywords
    .filter(kw => kw.resumeCount < kw.count && kw.score >= 60)
    .slice(0, 8)
    .map(kw => ({
      term: kw.term,
      jobCount: kw.count,
      resumeCount: kw.resumeCount,
      reason: `Mentioned ${kw.resumeCount}x in resume but ${kw.count}x in job (add ${kw.count - kw.resumeCount} more)`
    }));

  return {
    toAdd,
    wellRepresented,
    needEmphasis,
    overallMatch: analysis.overallMatch
  };
};

/**
 * Get keyword distribution by category (skills, action verbs, etc.)
 * @param {string} text - Input text
 * @returns {Object} Categorized keywords
 */
export const categorizeKeywords = (text) => {
  const tokens = tokenize(text);
  const frequency = calculateTermFrequency(tokens);

  // Common action verbs for resumes
  const actionVerbs = new Set([
    "achieved", "managed", "led", "developed", "created", "implemented", "designed",
    "improved", "increased", "reduced", "optimized", "delivered", "executed", "built",
    "launched", "established", "directed", "coordinated", "analyzed", "maintained"
  ]);

  // Technical skills patterns (basic heuristic)
  const technicalPatterns = /^(python|java|javascript|react|node|aws|docker|sql|api|cloud|data|machine|learning|ai)/i;

  const categories = {
    actionVerbs: [],
    technical: [],
    business: [],
    other: []
  };

  for (const [term, count] of frequency) {
    if (GENERIC_TERMS.has(term)) continue;

    const entry = { term, count };

    if (actionVerbs.has(term)) {
      categories.actionVerbs.push(entry);
    } else if (technicalPatterns.test(term)) {
      categories.technical.push(entry);
    } else if (term.length > 6) {
      categories.business.push(entry);
    } else {
      categories.other.push(entry);
    }
  }

  // Sort each category by frequency
  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => b.count - a.count);
  }

  return categories;
};

export default {
  tokenize,
  calculateTermFrequency,
  calculateTFIDF,
  analyzeKeywordDensity,
  suggestKeywordChanges,
  categorizeKeywords
};
