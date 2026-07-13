function normalizeTerm(value) {
  const trimmed = value.trim();
  const theme = trimmed.split(':')[0]?.trim();
  return theme || trimmed;
}

function extractDeniedTerm(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/\b(?:do not|don't|dont|never)\s+(?:have\s+)?(.+?)\.?$/i);
  return match?.[1]
    ?.replace(/\s+(?:experience|skills?|background|expertise)$/i, '')
    .trim() || '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTerms(userHardStops) {
  if (!Array.isArray(userHardStops)) return [];
  return [...new Set(userHardStops.flatMap(item => {
    if (typeof item !== 'string') return [];
    return [normalizeTerm(item), extractDeniedTerm(item)]
      .map(term => term.toLocaleLowerCase())
      .filter(Boolean);
  }))];
}

function containsHardStop(value, terms) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLocaleLowerCase();
  return terms.some(term => {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'u');
    return pattern.test(normalized);
  });
}

function filterStrings(values, terms) {
  return Array.isArray(values)
    ? values.filter(value => !containsHardStop(value, terms))
    : values;
}

function objectContainsHardStop(value, terms) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(item => {
    if (typeof item === 'string') return containsHardStop(item, terms);
    if (Array.isArray(item)) return item.some(child => typeof child === 'string' && containsHardStop(child, terms));
    return false;
  });
}

export function suppressHardStopClaims(optimization, userHardStops) {
  const terms = buildTerms(userHardStops);
  if (!optimization || typeof optimization !== 'object' || terms.length === 0) return optimization;

  const result = {
    ...optimization,
    gap_analysis: Array.isArray(optimization.gap_analysis)
      ? optimization.gap_analysis.filter(item => !objectContainsHardStop(item, terms))
      : optimization.gap_analysis,
    missing_keywords: filterStrings(optimization.missing_keywords, terms),
    keywords_to_keep: filterStrings(optimization.keywords_to_keep, terms),
  };

  if (Array.isArray(result.gap_analysis)) {
    result.gap_analysis = result.gap_analysis.filter(item => !(
      containsHardStop(item?.requirement, terms)
      || containsHardStop(item?.current_state, terms)
      || containsHardStop(item?.recommendation, terms)
    ));
  }

  if (containsHardStop(result.suggested_headline, terms)) {
    result.suggested_headline = result.original_headline;
  }
  if (containsHardStop(result.summary_rewrite, terms)) {
    result.summary_rewrite = result.original_summary;
  }

  if (Array.isArray(result.bullet_improvements)) {
    result.bullet_improvements = result.bullet_improvements.filter(item => !(
      containsHardStop(item?.improved, terms)
      || containsHardStop(item?.issue, terms)
      || containsHardStop(item?.rationale, terms)
    ));
  }
  if (Array.isArray(result.project_improvements)) {
    result.project_improvements = result.project_improvements.filter(item => !(
      containsHardStop(item?.project_name, terms)
      || containsHardStop(item?.improved, terms)
      || containsHardStop(item?.issue, terms)
      || containsHardStop(item?.rationale, terms)
    ));
  }
  if (Array.isArray(result.certification_recommendations)) {
    result.certification_recommendations = result.certification_recommendations.filter(item => !(
      containsHardStop(item?.name, terms)
      || containsHardStop(item?.issuer, terms)
      || containsHardStop(item?.relevance, terms)
    ));
  }

  const positionSuggestion = result.position_name_suggestion;
  if (positionSuggestion && (
    containsHardStop(positionSuggestion.suggested, terms)
    || containsHardStop(positionSuggestion.reason, terms)
  )) {
    result.position_name_suggestion = {
      ...positionSuggestion,
      suggested: positionSuggestion.original,
      reason: '',
      is_necessary: false,
      position_changes: [],
    };
  }

  return result;
}
