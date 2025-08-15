let resumeData = null;
let jobDescription = '';
let apiKeys = { openai: '', anthropic: '' };
let currentOptimization = null;

function getElement(id) {
  return document.getElementById(id);
}

function saveData() {
  localStorage.setItem('resumeCustomizer', JSON.stringify({
    resumeData,
    jobDescription,
    apiKeys
  }));
}

function loadData() {
  const saved = localStorage.getItem('resumeCustomizer');
  if (!saved) return;

  const data = JSON.parse(saved);
  resumeData = data.resumeData || null;
  jobDescription = data.jobDescription || '';
  apiKeys = data.apiKeys || { openai: '', anthropic: '' };

  if (resumeData) {
    getElement('json-output').textContent = JSON.stringify(resumeData, null, 2);
    getElement('resume-json').style.display = 'block';
  }

  if (jobDescription) {
    getElement('job-input').value = jobDescription;
  }

  getElement('openai-key').value = apiKeys.openai || '';
  getElement('anthropic-key').value = apiKeys.anthropic || '';
}

function showTab(tabName, eventTarget) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  if (eventTarget) eventTarget.classList.add('active');
  document.getElementById(tabName).classList.add('active');
}

function saveApiKeys() {
  apiKeys.openai = getElement('openai-key').value.trim();
  apiKeys.anthropic = getElement('anthropic-key').value.trim();
  saveData();
  alert('API keys saved successfully!');
}

function showLoading(message) {
  // Simple dev aid; consider wiring a visible spinner div if needed
  console.log(message);
}

async function parseResume() {
  const resumeText = getElement('resume-input').value;
  if (!resumeText.trim()) {
    alert('Please paste your resume text first');
    return;
  }

  showLoading('Parsing resume...');

  if (!apiKeys.openai && !apiKeys.anthropic) {
    resumeData = createMockResumeData(resumeText);
    displayResumeJson();
    saveData();
    return;
  }

  if (apiKeys.openai && !apiKeys.openai.startsWith('sk-')) {
    alert('Invalid OpenAI API key format. Key should start with "sk-"');
    return;
  }
  if (apiKeys.anthropic && !apiKeys.anthropic.startsWith('sk-ant-')) {
    alert('Invalid Anthropic API key format. Key should start with "sk-ant-"');
    return;
  }

  try {
    const prompt = `Parse this resume into a structured JSON format:\n\n${resumeText}\n\nReturn only valid JSON with this structure:\n{\n  "personal": {\n    "name": "",\n    "email": "",\n    "phone": "",\n    "location": "",\n    "linkedin": "",\n    "github": ""\n  },\n  "summary": "",\n  "experience": [\n    {\n      "company": "",\n      "position": "",\n      "duration": "",\n      "responsibilities": [""],\n      "achievements": [""]\n    }\n  ],\n  "skills": {\n    "technical": [""],\n    "soft": [""]\n  },\n  "education": [\n    {\n      "degree": "",\n      "institution": "",\n      "year": "",\n      "gpa": ""\n    }\n  ],\n  "projects": [\n    {\n      "name": "",\n      "description": "",\n      "technologies": [""]\n    }\n  ]\n}`;

    const { callAI } = await import('/ai.js');
    const response = await callAI(prompt, apiKeys);

    let jsonText = response;
    if (response.includes('```json')) {
      jsonText = response.split('```json')[1].split('```')[0].trim();
    } else if (response.includes('```')) {
      jsonText = response.split('```')[1].split('```')[0].trim();
    }

    resumeData = JSON.parse(jsonText);
    displayResumeJson();
    saveData();
    alert('Resume parsed successfully!');
  } catch (error) {
    console.error('Error parsing resume:', error);
    alert(`Error parsing resume: ${error.message}\n\nFalling back to demo mode...`);
    resumeData = createMockResumeData(resumeText);
    displayResumeJson();
    saveData();
  }
}

function displayResumeJson() {
  getElement('json-output').textContent = JSON.stringify(resumeData, null, 2);
  getElement('resume-json').style.display = 'block';
}

function editJson() {
  const currentJson = JSON.stringify(resumeData, null, 2);
  const newJson = prompt('Edit your resume JSON:', currentJson);
  if (newJson) {
    try {
      resumeData = JSON.parse(newJson);
      displayResumeJson();
      saveData();
      alert('Resume JSON updated successfully!');
    } catch (error) {
      alert('Invalid JSON format. Please check your syntax.');
    }
  }
}

function createMockResumeData(text) {
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const phoneMatch = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  return {
    personal: {
      name: 'John Doe',
      email: emailMatch ? emailMatch[0] : 'john.doe@email.com',
      phone: phoneMatch ? phoneMatch[0] : '+1-555-123-4567',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/johndoe',
      github: 'github.com/johndoe'
    },
    summary: 'Experienced software developer with 5+ years in full-stack development...',
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Developer',
        duration: '2022-Present',
        responsibilities: ['Led development team', 'Architected scalable solutions'],
        achievements: ['Increased system performance by 40%', 'Reduced deployment time by 60%']
      }
    ],
    skills: {
      technical: ['JavaScript', 'Python', 'React', 'Node.js', 'AWS'],
      soft: ['Leadership', 'Communication', 'Problem-solving']
    },
    education: [
      {
        degree: 'BS Computer Science',
        institution: 'University of Technology',
        year: '2018',
        gpa: '3.8'
      }
    ],
    projects: [
      {
        name: 'E-commerce Platform',
        description: 'Built full-stack e-commerce solution',
        technologies: ['React', 'Node.js', 'MongoDB']
      }
    ]
  };
}

async function analyzeMatch() {
  jobDescription = getElement('job-input').value;
  if (!jobDescription.trim()) {
    alert('Please paste the job description first');
    return;
  }
  if (!resumeData) {
    alert('Please parse your resume first');
    return;
  }

  showLoading('Analyzing match...');
  try {
    const prompt = `Analyze the match between this resume and job description. Return JSON with score (0-100) and detailed analysis:\n\nRESUME:\n${JSON.stringify(resumeData, null, 2)}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn only valid JSON:\n{\n  "score": 85,\n  "analysis": "Detailed analysis...",\n  "strengths": ["Strong technical skills", "Relevant experience"],\n  "gaps": ["Missing certification", "Limited cloud experience"],\n  "recommendations": ["Add AWS certification", "Highlight cloud projects"]\n}`;

    const { callAI } = await import('/ai.js');
    const response = await callAI(prompt, apiKeys);
    const matchResult = JSON.parse(response);
    displayMatchResult(matchResult);
    saveData();
  } catch (_error) {
    const demoResult = {
      score: 78,
      analysis: 'Good match with strong technical alignment. Resume shows relevant experience but could benefit from highlighting specific skills mentioned in the job description.',
      strengths: ['Strong technical background', 'Relevant project experience', 'Good educational foundation'],
      gaps: ['Missing specific framework experience', 'Limited cloud certifications', 'Could emphasize leadership skills more'],
      recommendations: ['Add cloud certification details', 'Highlight team leadership experience', 'Include specific metrics and achievements']
    };
    displayMatchResult(demoResult);
  }
}

function displayMatchResult(result) {
  const scoreDisplay = getElement('score-display');
  const scoreValue = getElement('score-value');
  const scoreDescription = getElement('score-description');

  scoreValue.textContent = result.score;
  scoreDescription.textContent = result.analysis;

  if (result.score >= 80) {
    scoreDisplay.className = 'score-display excellent';
  } else if (result.score >= 60) {
    scoreDisplay.className = 'score-display good';
  } else {
    scoreDisplay.className = 'score-display';
  }

  const suggestionsContent = getElement('suggestions-content');
  suggestionsContent.innerHTML = `
    <div class="suggestion-item">
      <strong>Strengths:</strong> ${result.strengths.join(', ')}
    </div>
    <div class="suggestion-item">
      <strong>Areas to Improve:</strong> ${result.gaps.join(', ')}
    </div>
    <div class="suggestion-item">
      <strong>Recommendations:</strong> ${result.recommendations.join(', ')}
    </div>
  `;

  getElement('match-result').style.display = 'block';
}

async function optimizeSection() {
  const section = document.getElementById('section-select').value;
  if (!resumeData || !jobDescription) {
    alert('Please complete resume parsing and job analysis first');
    return;
  }

  showLoading('Optimizing section...');
  try {
    const prompt = `Optimize the ${section} section of this resume for the given job description:\n\nCURRENT ${section.toUpperCase()}:\n${JSON.stringify(resumeData[section], null, 2)}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn only the optimized JSON structure for the ${section} section, maintaining the same format but with improved content that better matches the job requirements.`;

    const { callAI } = await import('/ai.js');
    const response = await callAI(prompt, apiKeys);
    const optimizedSection = JSON.parse(response);
    displayOptimizedContent(section, optimizedSection);
  } catch (_error) {
    const demoOptimization = getDemoOptimization(section);
    displayOptimizedContent(section, demoOptimization);
  }
}

function getDemoOptimization(section) {
  const optimizations = {
    summary: 'Results-driven software engineer with 5+ years of experience in full-stack development and cloud architecture. Proven track record of leading cross-functional teams and delivering scalable solutions that drive business growth. Expertise in modern web technologies with strong focus on performance optimization and user experience.',
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Full-Stack Developer',
        duration: '2022-Present',
        responsibilities: ['Led development of microservices architecture', 'Mentored junior developers', 'Implemented CI/CD pipelines'],
        achievements: ['Increased system performance by 40%', 'Reduced deployment time by 60%', 'Led team of 5 engineers']
      }
    ],
    skills: {
      technical: ['JavaScript/TypeScript', 'React/Vue.js', 'Node.js', 'Python', 'AWS/Azure', 'Docker', 'Kubernetes'],
      soft: ['Technical Leadership', 'Cross-functional Collaboration', 'Agile Methodologies']
    }
  };
  return optimizations[section] || resumeData[section];
}

function displayOptimizedContent(section, content) {
  getElement('optimized-content').textContent = JSON.stringify(content, null, 2);
  getElement('optimization-result').style.display = 'block';
  currentOptimization = { section, content };
}

function acceptOptimization() {
  if (!currentOptimization) return;
  resumeData[currentOptimization.section] = currentOptimization.content;
  saveData();
  alert('Optimization accepted! Your resume has been updated.');
  displayResumeJson();
}

function exportResume() {
  if (!resumeData) {
    alert('No resume data to export');
    return;
  }

  const formattedResume = formatResumeForExport(resumeData);
  const blob = new Blob([formattedResume], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'optimized_resume.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function formatResumeForExport(data) {
  let formatted = '';
  formatted += `${data.personal.name}\n`;
  formatted += `${data.personal.email} | ${data.personal.phone}\n`;
  formatted += `${data.personal.location}\n`;
  if (data.personal.linkedin) formatted += `LinkedIn: ${data.personal.linkedin}\n`;
  if (data.personal.github) formatted += `GitHub: ${data.personal.github}\n`;
  formatted += '\n';
  formatted += 'PROFESSIONAL SUMMARY\n';
  formatted += '===================\n';
  formatted += `${data.summary}\n\n`;
  formatted += 'WORK EXPERIENCE\n';
  formatted += '===============\n';
  data.experience.forEach(exp => {
    formatted += `${exp.position} at ${exp.company} (${exp.duration})\n`;
    exp.responsibilities.forEach(resp => formatted += `• ${resp}\n`);
    exp.achievements.forEach(ach => formatted += `• ${ach}\n`);
    formatted += '\n';
  });
  formatted += 'SKILLS\n';
  formatted += '======\n';
  formatted += `Technical: ${data.skills.technical.join(', ')}\n`;
  formatted += `Soft Skills: ${data.skills.soft.join(', ')}\n\n`;
  formatted += 'EDUCATION\n';
  formatted += '=========\n';
  data.education.forEach(edu => {
    formatted += `${edu.degree}, ${edu.institution} (${edu.year})\n`;
    if (edu.gpa) formatted += `GPA: ${edu.gpa}\n`;
    formatted += '\n';
  });
  return formatted;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-target');
      showTab(target, e.currentTarget);
    });
  });

  // Buttons
  getElement('save-keys-btn').addEventListener('click', saveApiKeys);
  getElement('parse-btn').addEventListener('click', parseResume);
  getElement('edit-json-btn').addEventListener('click', editJson);
  getElement('analyze-btn').addEventListener('click', analyzeMatch);
  getElement('optimize-btn').addEventListener('click', optimizeSection);
  getElement('accept-btn').addEventListener('click', acceptOptimization);
  getElement('export-btn').addEventListener('click', exportResume);
}

function init() {
  loadData();
  bindEvents();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);