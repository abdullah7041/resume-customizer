function isValidBand(band) {
  return Array.isArray(band) &&
    band.length === 2 &&
    band.every((value) => typeof value === 'number' && Number.isFinite(value)) &&
    band[0] >= 0 &&
    band[1] <= 100 &&
    band[0] <= band[1];
}

export function scoreBandFlags(result, fixture) {
  const flags = [];
  const band = fixture.expected?.matchScoreBand;
  const matchScore = result?.match_score;
  const afterScore = result?.after_score;

  if (!isValidBand(band)) return ['match_score_band_missing_or_invalid'];

  if (typeof matchScore !== 'number' || !Number.isFinite(matchScore)) {
    flags.push('match_score_missing');
  } else if (matchScore < band[0] || matchScore > band[1]) {
    flags.push(`match_score_out_of_band:${matchScore} not in [${band[0]},${band[1]}]`);
  }

  if (typeof afterScore !== 'number' || !Number.isFinite(afterScore)) {
    flags.push('after_score_missing');
  } else if (typeof matchScore === 'number' && Number.isFinite(matchScore)) {
    if (afterScore < matchScore) flags.push(`after_score_below_match:${afterScore}<${matchScore}`);
    if (matchScore < 0 || matchScore > 100 || afterScore < 0 || afterScore > 100) {
      flags.push(`score_out_of_range:match=${matchScore},after=${afterScore}`);
    }
  }

  return flags;
}
