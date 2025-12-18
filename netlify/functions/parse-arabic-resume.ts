import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initSentry, captureError } from '../lib/sentry';

initSentry();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY is not set.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');
const MODEL_NAME = 'gemini-2.5-flash-lite';

const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { resumeText, targetLanguage = 'ar' } = JSON.parse(event.body || '{}');

    if (!resumeText) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Resume text required' }) };
    }

    const systemPrompt = targetLanguage === 'ar'
      ? `أنت محلل سير ذاتية متخصص. قم بتحليل السيرة الذاتية واستخراج المعلومات بتنسيق JSON.
         يجب أن يكون الرد بالعربية للمحتوى العربي وبالإنجليزية للمحتوى الإنجليزي.
         حافظ على الدقة ولا تضف معلومات غير موجودة في النص الأصلي.`
      : `You are a professional resume analyst. Parse the resume and extract information in JSON format.
         Preserve the original language of the content. Do not add information not present in the original text.`;

    const prompt = `${systemPrompt}

Parse this resume into structured JSON:

${resumeText}

Return JSON with this structure:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "objective": "",
  "experience": [
    {
      "title": "",
      "titleEn": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "description": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "graduationDate": "",
      "gpa": ""
    }
  ],
  "skills": [],
  "certifications": [],
  "languages": [
    { "name": "", "level": "" }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();
    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Parse error:', error);
    captureError(error, {
      function: 'parse-arabic-resume',
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse resume' }),
    };
  }
};
