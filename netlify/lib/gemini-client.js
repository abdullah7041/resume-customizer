import { executeAiContract, MAX_PARSE_INPUT_CHARS } from './ai-contracts/index.js';
import { MODELS } from './model-registry.js';
import { summarizeErrorForLog } from './sentry.js';
import { suppressHardStopClaims } from './hard-stop-suppression.js';
import {
  buildFallbackStrategicRealityCheck,
  postProcessStrategicRealityCheck,
} from './strategic-reality-check.js';

function extractSummaryFromInput(inputData, parsed) {
  let summary = parsed.basics?.summary || '';
  if ((!summary || summary.length < 50) && typeof inputData === 'string') {
    const summaryMatch = inputData.match(
      /(?:SUMMARY|PROFESSIONAL SUMMARY|PROFILE|OBJECTIVE|ABOUT)[:\s]*\n?([\s\S]*?)(?=\n\n|\n(?:EXPERIENCE|WORK|EDUCATION|SKILLS|CERTIFICATIONS?|PROJECTS?|$))/i,
    );
    if (summaryMatch?.[1]) {
      const extractedSummary = summaryMatch[1].trim();
      if (extractedSummary.length > 50) {
        summary = extractedSummary;
        parsed.basics = parsed.basics || {};
        parsed.basics.summary = summary;
      }
    }
  }
  return summary;
}

function buildLegacyParseShape(parsed, inputData, isPdf) {
  const result = { ...parsed };
  result.plainText = (!isPdf && typeof inputData === 'string') ? inputData : '';
  result.basics = result.basics || {};
  result.work = result.work || [];
  result.education = result.education || [];
  result.skills = result.skills || [];
  result.projects = result.projects || [];
  result.certificates = result.certificates || [];
  result.languages = result.languages || [];
  result.meta = result.meta || {};

  result.candidateProfile = {
    name: result.basics?.name || '',
    email: result.basics?.email || '',
    phone: result.basics?.phone || '',
    location: result.basics?.location
      ? `${result.basics.location.city || ''}, ${result.basics.location.region || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
      : '',
    links: (result.basics?.profiles || []).map(profile => profile.url).filter(Boolean),
  };

  const summary = extractSummaryFromInput(inputData, result);
  result.summary = summary;
  result.skills = (result.skills || []).flatMap(skill => (
    typeof skill === 'string' ? [skill] : (skill.keywords || [])
  ));
  result.experience = (result.work || []).map(work => ({
    title: work.position || '',
    company: work.name || '',
    dates: `${work.startDate || ''} - ${work.endDate || ''}`.trim(),
    description: [work.summary, ...(work.highlights || [])].filter(Boolean).join('\n• '),
  }));
  result.certifications = (result.certificates || []).map(cert => cert.name).filter(Boolean);

  console.log(`[Gemini] Extraction Summary:
      - Work: ${result.work.length} entries
      - Education: ${result.education.length} entries
      - Skills: ${result.skills.length} keywords
      - Certificates: ${result.certificates.length} entries
      - Projects: ${result.projects?.length || 0} entries
    `);

  return result;
}

export async function parseResumeOnly(inputData, isPdf = true, options = {}) {
  if (isPdf) {
    throw new Error('PDF inline data not supported with OpenRouter. Please convert PDF to text first using OCR.');
  }

  const MAX_INPUT_CHARS = MAX_PARSE_INPUT_CHARS;
  const trimmedInput = (typeof inputData === 'string' && inputData.length > MAX_INPUT_CHARS)
    ? inputData.substring(0, MAX_INPUT_CHARS)
    : inputData;

  if (trimmedInput !== inputData) {
    console.warn(`[OpenRouter] Input too long (${inputData.length} chars), truncating to ${MAX_INPUT_CHARS} chars`);
  }

  // Evidence-driven focused retry: extract-resume-json passes focusSections when the
  // first parse pass dropped sections that the raw text clearly contains.
  const focusSections = Array.isArray(options.focusSections) ? options.focusSections : [];

  try {
    console.log(`[OpenRouter] Parsing resume with ${MODELS.lite}. Input type: Text, length: ${trimmedInput.length} chars${focusSections.length ? `, focus: ${focusSections.join(',')}` : ''}`);
    const parsed = await executeAiContract('parse_resume', {
      inputData: trimmedInput,
      focusSections,
    }, {
      ...options,
      featureName: options.featureName || 'parse_resume',
    });
    return buildLegacyParseShape(parsed, inputData, isPdf);
  } catch (error) {
    console.error('[OpenRouter] Error parsing resume:', summarizeErrorForLog(error));
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('API_KEY') || errorMessage.includes('permission') || errorMessage.includes('403')) {
      throw new Error('API key error: Please verify your OPENROUTER_API_KEY is valid and has proper permissions.');
    }
    if (errorMessage.includes('quota') || errorMessage.includes('429')) {
      throw new Error('API quota exceeded. Please try again later.');
    }
    if (errorMessage.includes('model') || errorMessage.includes('404')) {
      throw new Error(`Model error: The model '${MODELS.lite}' may not be available. Please check the model name.`);
    }
    throw error;
  }
}

export async function optimizeResume(resumeText, jobDescription, language = 'en', vulnerabilities = [], userClarifications = '', userHardStops = [], options = {}) {
  const contractId = options.featureName === 'optimize_stream' ? 'optimize_stream' : 'optimize';
  const MAX_RESUME_CHARS = 15000;
  const MAX_JD_CHARS = 5000;
  const trimmedResume = (typeof resumeText === 'string' && resumeText.length > MAX_RESUME_CHARS)
    ? resumeText.substring(0, MAX_RESUME_CHARS)
    : resumeText;
  const trimmedJD = (typeof jobDescription === 'string' && jobDescription.length > MAX_JD_CHARS)
    ? jobDescription.substring(0, MAX_JD_CHARS)
    : jobDescription;

  if (trimmedResume !== resumeText) {
    console.warn(`[OpenRouter] Resume too long (${resumeText.length} chars), truncating to ${MAX_RESUME_CHARS}`);
  }
  if (trimmedJD !== jobDescription) {
    console.warn(`[OpenRouter] JD too long (${jobDescription.length} chars), truncating to ${MAX_JD_CHARS}`);
  }

  try {
    console.log(`[OpenRouter] Optimizing with ${MODELS.flash} (resume: ${trimmedResume.length} chars, JD: ${trimmedJD.length} chars)`);
    const result = await executeAiContract(contractId, {
      resumeText: trimmedResume,
      jobDescription: trimmedJD,
      language,
      vulnerabilities,
      userClarifications,
      userHardStops,
    }, {
      ...options,
      featureName: options.featureName || 'optimize_resume',
    });
    console.log('[OpenRouter] Optimize contract validated');
    return suppressHardStopClaims(result, userHardStops);
  } catch (error) {
    console.error('[OpenRouter] Error in optimizeResume:', summarizeErrorForLog(error));
    throw error;
  }
}

export async function processMatchOnly(resumeText, jobDescription, language = 'en', options = {}) {
  const MAX_RESUME = 15000;
  const MAX_JD = 5000;
  const trimmedResume = (typeof resumeText === 'string' && resumeText.length > MAX_RESUME)
    ? resumeText.substring(0, MAX_RESUME)
    : resumeText;
  const trimmedJD = (typeof jobDescription === 'string' && jobDescription.length > MAX_JD)
    ? jobDescription.substring(0, MAX_JD)
    : jobDescription;

  console.log(`[Gemini] Fast match analysis with ${MODELS.flash} (resume: ${trimmedResume.length} chars, JD: ${trimmedJD.length} chars)`);

  try {
    const parsed = await executeAiContract('ai_match_reality_check', {
      resumeText: trimmedResume,
      jobDescription: trimmedJD,
      language,
    }, {
      ...options,
      featureName: options.featureName || 'ai_match_reality_check',
    });

    return {
      score: parsed.score,
      categoryScores: parsed.categoryScores,
      strongMatches: parsed.strongMatches,
      missingKeywords: parsed.missingKeywords,
      summary_bullets: parsed.summary_bullets,
      reasoning: parsed.reasoning,
      strategicRealityCheck: postProcessStrategicRealityCheck(parsed.strategicRealityCheck, {
        resumeText: trimmedResume,
        jobText: trimmedJD,
      }),
    };
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.status === 504) {
      console.error('[Gemini] Error in fast match analysis:', summarizeErrorForLog(error));
      throw error;
    }

    console.warn('[Gemini] Combined match + Reality Check failed, falling back to match-only contract:', summarizeErrorForLog(error));
    try {
      const parsed = await executeAiContract('ai_match', {
        resumeText: trimmedResume,
        jobDescription: trimmedJD,
        language,
      }, {
        ...options,
        featureName: options.featureName || 'ai_match',
      });

      return {
        score: parsed.score,
        categoryScores: parsed.categoryScores,
        strongMatches: parsed.strongMatches,
        missingKeywords: parsed.missingKeywords,
        summary_bullets: parsed.summary_bullets,
        reasoning: parsed.reasoning,
        strategicRealityCheck: buildFallbackStrategicRealityCheck('Reality Check used a safe fallback after contract validation failed.'),
      };
    } catch (fallbackError) {
      console.error('[Gemini] Error in fast match analysis:', summarizeErrorForLog(fallbackError));
      throw fallbackError;
    }
  }
}

export async function analyzeResumeTruthCheck(resumeText, language = 'en', options = {}) {
  const MAX_RESUME = 15000;
  const trimmedResume = (typeof resumeText === 'string' && resumeText.length > MAX_RESUME)
    ? resumeText.substring(0, MAX_RESUME)
    : resumeText;

  console.log(`[Gemini] Resume Truth Check with ${MODELS.flash} (resume: ${trimmedResume.length} chars)`);

  try {
    const { userHardStops = [], ...contractOptions } = options;
    return await executeAiContract('resume_truth_check', {
      resumeText: trimmedResume,
      language,
      userHardStops,
    }, {
      ...contractOptions,
      featureName: contractOptions.featureName || 'resume_truth_check',
    });
  } catch (error) {
    console.error('[OpenRouter] Error in analyzeResumeTruthCheck:', summarizeErrorForLog(error));
    throw error;
  }
}

export async function predictInterviewQuestions(resumeText, jobDescription, questionType = 'mixed', vulnerabilities = [], language = 'en', options = {}) {
  console.log(`[Gemini] Predicting interview questions (${questionType}) with ${MODELS.lite}, vulnerabilities: ${vulnerabilities.length}`);

  try {
    return await executeAiContract('interview_prep', {
      resumeText,
      jobDescription,
      questionType,
      vulnerabilities,
      language,
    }, {
      ...options,
      featureName: options.featureName || 'interview_prep',
    });
  } catch (error) {
    console.error('[OpenRouter] Error predicting interview questions:', summarizeErrorForLog(error));
    throw error;
  }
}

export async function generateCoverLetter(resumeText, jobDescription, language = 'en', tone = 'professional', options = {}) {
  console.log(`[Gemini] Generating cover letter with ${MODELS.flash} (tone: ${tone})`);

  try {
    return await executeAiContract('cover_letter', {
      resumeText,
      jobDescription,
      language,
      tone,
    }, {
      ...options,
      featureName: options.featureName || 'cover_letter',
    });
  } catch (error) {
    console.error('[OpenRouter] Error generating cover letter:', summarizeErrorForLog(error));
    throw error;
  }
}
