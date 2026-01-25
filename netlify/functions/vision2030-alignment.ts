import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { callOpenRouter } from '../lib/openrouter-client';
import { withRateLimit } from '../lib/rate-limiter';
import { Vision2030RequestSchema, formatZodError } from '../lib/resume-schemas';
import { initSentry, captureError } from '../lib/sentry';
import { checkCredits, consumeCredits } from '../lib/credit-manager';

initSentry();

// Vision 2030 Analysis Response Schema
const Vision2030ResponseSchema = {
  type: 'object',
  properties: {
    overallScore: { type: 'number', minimum: 0, maximum: 100 },
    matchedSkills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skillNameEn: { type: 'string' },
          skillNameAr: { type: 'string' },
          sectorId: { type: 'string' },
          sectorNameEn: { type: 'string' },
          sectorNameAr: { type: 'string' },
          matchedKeyword: { type: 'string' },
          weight: { type: 'number' },
          context: { type: 'string' }
        },
        required: ['skillNameEn', 'skillNameAr', 'sectorId', 'sectorNameEn', 'sectorNameAr', 'matchedKeyword', 'weight', 'context']
      }
    },
    missingSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skillNameEn: { type: 'string' },
          skillNameAr: { type: 'string' },
          sectorId: { type: 'string' },
          sectorNameEn: { type: 'string' },
          sectorNameAr: { type: 'string' },
          relevanceScore: { type: 'number' },
          reason: { type: 'string' },
          reasonAr: { type: 'string' }
        },
        required: ['skillNameEn', 'skillNameAr', 'sectorId', 'sectorNameEn', 'sectorNameAr', 'relevanceScore', 'reason', 'reasonAr']
      }
    },
    sectorBreakdown: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectorId: { type: 'string' },
          sectorNameEn: { type: 'string' },
          sectorNameAr: { type: 'string' },
          icon: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          matchedCount: { type: 'number' },
          totalSkills: { type: 'number' },
          suggestedKeywords: { type: 'array', items: { type: 'string' } }
        },
        required: ['sectorId', 'sectorNameEn', 'sectorNameAr', 'icon', 'score', 'matchedCount', 'totalSkills', 'suggestedKeywords']
      }
    },
    topSectors: { type: 'array', items: { type: 'string' } },
    allSectorsWithMatches: { type: 'array', items: { type: 'string' } },
    detectedCareer: {
      type: 'object',
      properties: {
        archetypeId: { type: 'string' },
        archetypeNameEn: { type: 'string' },
        archetypeNameAr: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['archetypeId', 'archetypeNameEn', 'archetypeNameAr', 'confidence']
    }
  },
  required: ['overallScore', 'matchedSkills', 'missingSuggestions', 'sectorBreakdown', 'topSectors', 'allSectorsWithMatches', 'detectedCareer']
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
    };
  }

  // Verify token and get authenticated user
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired authentication token' })
    };
  }

  const userId = user.id;

  // Check credits BEFORE processing (2 credits for vision2030)
  const creditCheck = await checkCredits(userId, 'vision2030');

  if (!creditCheck.hasCredits) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Insufficient credits',
        creditsRequired: creditCheck.required,
        creditsAvailable: creditCheck.available,
        creditsNeeded: creditCheck.required - creditCheck.available
      })
    };
  }

  try {
    const rawBody = JSON.parse(event.body || '{}');

    // Validate request using Zod schema
    const parseResult = Vision2030RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, language = 'en', jobDescription } = parseResult.data;

    const startTime = Date.now();

    // Build comprehensive AI prompt with Vision 2030 sector data
    const aiPrompt = buildVision2030Prompt(resumeText, jobDescription, language);

    // Call OpenRouter with structured output for consistent response format
    const analysisJson = await callOpenRouter('flash', [
      {
        role: 'user',
        content: aiPrompt
      }
    ], Vision2030ResponseSchema, {
      temperature: 0.3,
      maxTokens: 4096,
      schemaName: 'vision2030_analysis'
    });

    console.log(`[vision2030-alignment] OpenRouter call took ${Date.now() - startTime}ms`);

    // Parse and validate AI response
    let analysis;
    try {
      analysis = JSON.parse(analysisJson);
    } catch (parseError) {
      console.error('[vision2030-alignment] Failed to parse AI response:', parseError);
      throw new Error('AI response parsing failed');
    }

    // Consume credits AFTER successful analysis
    await consumeCredits(userId, 'vision2030');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis)
    };

  } catch (error) {
    console.error('[vision2030-alignment] Error:', error);
    captureError(error, {
      function: 'vision2030-alignment',
      payload: JSON.parse(event.body || '{}')
    });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to analyze Vision 2030 alignment'
      })
    };
  }
};

/**
 * Build comprehensive AI prompt with Vision 2030 sector data
 */
function buildVision2030Prompt(resumeText: string, jobDescription: string | undefined, language: string): string {
  const isArabic = language === 'ar';

  const sectorData = `
## Vision 2030 Sectors & Strategic Initiatives

### 1. Technology & Digital Transformation (التقنية والتحول الرقمي)
- **Investment**: $14.67B in AI (2024), targeting $20B by 2030
- **Jobs Created**: 26,000+ new jobs by 2030, 500,000+ IT opportunities
- **Key Initiatives**: SDAIA (Saudi Data & AI Authority), NSDAI (Saudi National Strategy for Data & AI), SAMAI (1M citizens trained in AI)
- **Core Skills**: Artificial Intelligence, Machine Learning, Cloud Computing, Cybersecurity, DevOps, Software Engineering, Data Science, IoT, Blockchain
- **Keywords**: AI, ML, Python, Java, C++, Cloud (AWS, Azure, GCP), Kubernetes, Docker, React, Angular, Node.js, Database Design, API Development

### 2. Tourism & Entertainment (السياحة والترفيه)
- **Investment**: Red Sea Project ($27B), Qiddiya Entertainment City ($20-42B), Six Flags Saudi Arabia, Aquarabia
- **Major Projects**: NEOM (THE LINE, Oxagon, Trojena, Sindalah), Diriyah Gate, Al Marjan Island
- **Jobs**: 300,000+ jobs in hospitality, tourism, and entertainment sectors
- **Core Skills**: Tourism Management, Hospitality, Event Management, F&B Operations, Hotel Management, Adventure/Eco-Tourism, Cultural Heritage Management
- **Keywords**: Hotel Management, Event Planning, Tour Guide, Hospitality Operations, Customer Service, Revenue Management, F&B Operations, Convention Planning

### 3. Renewable Energy (الطاقة المتجددة)
- **Investment**: NEOM Green Hydrogen ($8.4B capacity), Solar/Wind projects across Saudi Arabia
- **Target**: 50% renewable energy by 2030
- **Jobs**: 50,000+ green jobs across engineering, operations, and maintenance
- **Core Skills**: Solar Engineering, Wind Energy, Green Hydrogen, Energy Management, Sustainability Engineering, Environmental Science
- **Keywords**: Renewable Energy, Solar Power, Wind Energy, Green Hydrogen, Sustainability, Environmental Engineering, Carbon Reduction, Energy Efficiency

### 4. Healthcare & Life Sciences (الصحة والعلوم الحيوية)
- **Investment**: Saudi Pharma Hub, Wellness Tourism initiatives
- **Focus**: Pharmaceutical manufacturing, medical device development, healthcare research
- **Keywords**: Pharmaceutical, Clinical Research, Medical Device, Healthcare Administration, Telemedicine

### 5. Finance & Fintech (المالية والخدمات المالية)
- **Investment**: KAFD (King Abdulaziz Financial District) - 140+ tenants, 75+ regional HQs, Tadawul Stock Exchange
- **Focus**: Islamic Finance, Digital Banking, Fintech Innovation, Cryptocurrency/Blockchain
- **Keywords**: Banking, Finance, Fintech, Islamic Finance, Trading, Investment Management, Risk Management

### 6. Industry & Manufacturing (الصناعة والتصنيع)
- **Program**: NIDLP (National Industrial Development & Logistics Program)
- **Contribution**: 39% of non-oil GDP, 508K direct jobs in 2024
- **Keywords**: Manufacturing, Supply Chain, Logistics, Industrial Engineering, Quality Assurance, Operations Management

## Analysis Task
Analyze the provided resume and extract:
1. **Matched Skills**: Skills from the resume that align with Vision 2030 sectors
2. **Missing Skills**: High-impact skills that would increase alignment but are missing from resume
3. **Sector Breakdown**: Score for each sector (0-100) based on skill alignment
4. **Career Archetype**: Detect career pattern (Tech Leader, Tourism Manager, Energy Engineer, etc.)
5. **Recommendations**: Actionable suggestions in both English and Arabic

Provide recommendations in BOTH English and Arabic for maximum impact.
`;

  const jobDescriptionContext = jobDescription ? `\n\nJob Description Context:\n${jobDescription}` : '';

  return `${isArabic ? 'قم بتحليل السيرة الذاتية التالية' : 'Analyze the following resume'} against Saudi Vision 2030 strategic sectors:\n\n## Resume:\n${resumeText}${jobDescriptionContext}\n\n${sectorData}\n\nReturn JSON response matching the provided schema with these fields:
- overallScore: Weighted average (70% top 3 sectors, 30% overall)
- matchedSkills: Array of skills found in resume matching Vision 2030 sectors
- missingSuggestions: Array of high-impact missing skills for recommended sectors
- sectorBreakdown: Score breakdown for all 6 sectors with suggested keywords
- topSectors: Top 3 sector IDs by alignment score
- allSectorsWithMatches: All sectors with at least one matched skill
- detectedCareer: Career archetype with confidence level (high/medium/low)`;
}

// Export handler with rate limiting applied
export const handler = withRateLimit('vision2030-alignment', baseHandler);
