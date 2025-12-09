// src/services/exportPdf.js

import { buildResumeDocument } from "../../netlify/lib/normalize-resume.js";

const SECTION_KEYWORDS = {
  contact: ["contact", "contact information", "personal details"],
  summary: ["summary", "professional summary", "profile", "objective", "about"],
  skills: ["skills", "technical skills", "core skills", "competencies", "expertise"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "career history",
  ],
  education: ["education", "academic history", "academics", "training"],
  projects: ["projects", "selected projects", "key projects", "portfolio"],
};

const NON_TEXT_PATTERN = /[^\p{L}\p{N}\p{P}\p{Zs}]/gu;
const DIACRITIC_PATTERN = /\p{Diacritic}/gu;

const stripControlCharacters = (value) => {
  let sanitized = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159) || char === "\u2028" || char === "\u2029") {
      sanitized += " ";
    } else {
      sanitized += char;
    }
  }
  return sanitized;
};

const normalize = (value) => {
  const withoutDiacritics = value.normalize("NFKD").replace(DIACRITIC_PATTERN, "");
  return stripControlCharacters(withoutDiacritics.normalize("NFKC"))
    .replace(NON_TEXT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const isMeaningfulLine = (line) => {
  if (!line) {
    return false;
  }
  const compact = line.replace(/\s+/g, "");
  if (compact.length === 0) {
    return false;
  }
  const letters = compact.match(/\p{L}/gu)?.length ?? 0;
  const digits = compact.match(/\p{N}/gu)?.length ?? 0;
  const informative = letters + digits;
  if (compact.length <= 4) {
    return informative > 0;
  }
  return informative / compact.length >= 0.25;
};

const detectHeading = (line) => {
  const normalized = line.toLowerCase().replace(/[:.]+$/, "");
  return (
    Object.entries(SECTION_KEYWORDS).find(([, keys]) =>
      keys.some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `)),
    )?.[0] ?? null
  );
};

const splitLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => normalize(line))
    .filter(isMeaningfulLine);

const sanitizeLines = (items) =>
  Array.isArray(items)
    ? items
      .map((item) => normalize(String(item ?? "")))
      .filter(isMeaningfulLine)
    : [];

const ensureResumeDocument = (input) => {
  if (input && typeof input === "object" && typeof input.plainText === "string") {
    return {
      plainText: String(input.plainText),
      sections: Array.isArray(input.sections)
        ? input.sections.map((section) => ({
          id: typeof section.id === "string" ? section.id : null,
          title: typeof section.title === "string" ? section.title : null,
          content: sanitizeLines(section.content),
        }))
        : [],
      bullets: sanitizeLines(input.bullets),
    };
  }

  if (typeof input === "string") {
    return buildResumeDocument(input);
  }

  if (typeof input === "object" && typeof input?.plainText === "string") {
    return buildResumeDocument(input.plainText);
  }

  return buildResumeDocument("");
};

export const deriveResumeSections = (resumeText = "") => {
  const lines = splitLines(resumeText);
  const sections = {
    contactLines: [],
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
  };

  let current = "summary";
  let encounteredHeading = false;

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading === "contact" ? "contact" : heading;
      encounteredHeading = true;
      continue;
    }

    if (!encounteredHeading && sections.contactLines.length < 6) {
      sections.contactLines.push(line);
      continue;
    }

    if (current === "contact") {
      if (sections.contactLines.length < 6) {
        sections.contactLines.push(line);
      }
      continue;
    }

    if (!current || !sections[current]) {
      current = "summary";
    }

    sections[current].push(line);
  }

  if (sections.contactLines.length < 3) {
    const contactCandidates = lines.filter((line) =>
      /@|\b(?:linkedin|github|behance|riyadh)\b|\+?\d{3}/i.test(line),
    );
    for (const candidate of contactCandidates) {
      if (!sections.contactLines.includes(candidate) && sections.contactLines.length < 6) {
        sections.contactLines.push(candidate);
      }
    }
  }

  if (sections.summary.length === 0) {
    const paragraphs = resumeText
      .split(/\n{2,}/)
      .map((segment) => normalize(segment))
      .filter(Boolean);
    if (paragraphs.length > 0) {
      sections.summary.push(paragraphs[0]);
    }
  }

  const uniqueSkills = new Set();
  for (const entry of sections.skills) {
    entry
      .split(/[-,•·;|\u2022]/)
      .map((item) => normalize(item))
      .filter(Boolean)
      .forEach((skill) => {
        if (skill.length && uniqueSkills.size < 24) {
          uniqueSkills.add(skill);
        }
      });
  }
  sections.skills = Array.from(uniqueSkills);

  const condenseBullets = (items, limit) => {
    const condensed = [];
    for (const entry of items) {
      const segments = entry
        .split(/[-•\u2022*]+\s*/)
        .map((segment) => normalize(segment))
        .filter(Boolean);
      if (segments.length === 0) continue;
      if (segments.length === 1) {
        condensed.push(segments[0]);
      } else {
        condensed.push(segments.join(" – "));
      }
      if (condensed.length >= limit) {
        break;
      }
    }
    return condensed;
  };

  sections.summary = sections.summary.slice(0, 4);
  sections.experience = condenseBullets(sections.experience, 12);
  sections.education = condenseBullets(sections.education, 8);
  sections.projects = condenseBullets(sections.projects, 8);

  return sections;
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSummary = (summary, matchAnalysis, optimizations) => {
  const fragments = [];
  if (summary.length > 0) {
    fragments.push(
      summary
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("")
    );
  }

  if (matchAnalysis?.score != null) {
    const details = [
      `Match Score: ${Math.round(matchAnalysis.score)}/100`,
    ];
    if (matchAnalysis.coverage != null) {
      details.push(`Keyword coverage: ${Math.round((matchAnalysis.coverage ?? 0) * 100)}%`);
    }
    if (matchAnalysis.cosine != null) {
      details.push(`Similarity index: ${(matchAnalysis.cosine ?? 0).toFixed(2)}`);
    }
    fragments.push(`<p class="muted">${escapeHtml(details.join(" • "))}</p>`);
  }

  const actionable = Array.isArray(optimizations)
    ? optimizations
      .slice(0, 4)
      .map((card) => `${card.section}: ${card.suggestion}`)
      .filter(Boolean)
    : [];

  if (actionable.length > 0) {
    const items = actionable.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    fragments.push(`<ul class="stack">${items}</ul>`);
  }

  // Return actual content only - no sample data for ATS
  return fragments.join("");
};

const buildContact = (lines) => {
  if (!lines || lines.length === 0) {
    return { name: "Professional Resume", entries: [] }; // Provide default name if none found
  }
  const [primary, ...rest] = lines;
  return {
    name: primary || "Professional Resume",
    entries: rest,
  };
};

const buildExportHtml = ({ resumeDocument, resumeText = "", jobDescription = "", matchAnalysis, optimizations, keywords }) => {
  // Use structured data if available, otherwise parse text
  let sections = {};
  let contact = {};
  let documentText = "";

  if (resumeDocument && resumeDocument.header) {
    // It's a structured/merged document
    sections = {
      summary: [resumeDocument.summary].flat().filter(Boolean),
      skills: resumeDocument.skills || [],
      experience: resumeDocument.experience ? resumeDocument.experience.map(exp => {
        // Convert structured experience back to string format for display if needed
        // OR adapt the template to handle objects.
        // The existing template code expects strings in 'experience' array for most parts,
        // BUT `experience` in resumeUtils is an array of objects { company, position, description[] }.
        // The original `deriveResumeSections` returned an array of STRINGS for experience.
        // We need to adapt the renderer below to handle this.
        if (typeof exp === 'string') return exp;
        const bullets = Array.isArray(exp.description) ? exp.description.join(" ") : exp.description;
        return `${exp.position || ""} at ${exp.company || ""} - ${bullets}`;
      }) : [],
      education: resumeDocument.education ? resumeDocument.education.map(edu => {
        if (typeof edu === 'string') return edu;
        return `${edu.institution || ""} ${edu.date || ""}`;
      }) : [],
      projects: resumeDocument.projects || [],
      contactLines: [] // We'll build contact manually
    };

    contact = {
      name: resumeDocument.header.name,
      entries: [
        resumeDocument.header.email,
        resumeDocument.header.phone,
        resumeDocument.header.location,
        resumeDocument.header.linkedin
      ].filter(Boolean)
    };
    documentText = resumeDocument.plainText || "";
  } else {
    // Fallback to parsing
    const document = ensureResumeDocument(resumeDocument ?? resumeText);
    sections = deriveResumeSections(document.plainText);
    contact = buildContact(sections.contactLines);
    documentText = document.plainText;
  }

  const summaryHtml = buildSummary(sections.summary, matchAnalysis, optimizations);
  const jdSnippet = jobDescription ? `<p class="muted">Target role context: ${escapeHtml(jobDescription.slice(0, 240))}${jobDescription.length > 240 ? "…" : ""
    }</p>` : "";

  const contactContent =
    contact.entries.length > 0
      ? `<p class="contact-line">${contact.entries.map((item) => escapeHtml(item)).join(" • ")}</p>`
      : '';

  // Split skills into technical and soft skills for two-column layout
  const allSkills = Array.from(new Set([...sections.skills, ...(keywords?.add || [])]));
  const midPoint = Math.ceil(allSkills.length / 2);
  const technicalSkills = allSkills.slice(0, midPoint);
  const softSkills = allSkills.slice(midPoint);

  const buildSkillColumn = (skills, title) => {
    if (!skills || skills.length === 0) return '';
    return `
      <div class="skill-column">
        <h3 class="skill-category">${escapeHtml(title)}</h3>
        <ul class="skill-list">
          ${skills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}
        </ul>
      </div>
    `;
  };

  // Check if we have any structured content
  const hasStructuredContent =
    sections.experience.length > 0 ||
    sections.education.length > 0 ||
    sections.projects.length > 0 ||
    allSkills.length > 0 ||
    summaryHtml;

  // Fallback: if no sections parsed, show raw resume text
  const fallbackContent = !hasStructuredContent && document.plainText ? `
    <section class="resume-section">
      <div class="section-header">
        <div class="section-rule"></div>
        <h2 class="section-title">Resume Content</h2>
      </div>
      <div class="section-content">
        <p style="white-space: pre-wrap;">${escapeHtml(document.plainText)}</p>
      </div>
    </section>
  ` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Resume Export</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { 
        font-family: 'Calibri', 'Arial', 'Helvetica', sans-serif; 
        color: #212529; 
        background: #ffffff; 
        font-size: 11pt;
        line-height: 1.5;
      }
      body { padding: 0.5in 0.75in; max-width: 8.5in; margin: 0 auto; }
      
      /* Header - Professional centered name and contact */
      .resume-header { 
        text-align: center; 
        border-bottom: 2.5px solid #2c3e50; 
        padding-bottom: 14px; 
        margin-bottom: 20px; 
      }
      .resume-header h1 { 
        font-size: 26pt; 
        font-weight: 700; 
        letter-spacing: 0.08em; 
        margin-bottom: 6px; 
        text-transform: uppercase;
        color: #1a252f;
      }
      .contact-line { 
        font-size: 9.5pt; 
        color: #495057; 
        font-family: 'Calibri', 'Arial', sans-serif;
        line-height: 1.4;
      }
      
      /* Section styling with professional appearance */
      .resume-section { 
        margin-bottom: 18px; 
        page-break-inside: avoid;
      }
      .section-header { 
        display: flex; 
        align-items: center; 
        margin-bottom: 10px;
        gap: 10px;
        border-bottom: 1px solid #dee2e6;
        padding-bottom: 4px;
      }
      .section-rule { 
        width: 35px; 
        height: 2px; 
        background-color: #2c3e50; 
        flex-shrink: 0;
      }
      .section-title { 
        font-size: 13pt; 
        font-weight: 700; 
        text-transform: uppercase; 
        letter-spacing: 0.1em;
        flex-grow: 1;
        color: #2c3e50;
      }
      
      /* Content with proper spacing */
      .section-content { 
        padding-left: 45px; 
      }
      .section-content p { 
        margin-bottom: 7px; 
        text-align: justify;
        line-height: 1.5;
      }
      
      /* Two-column skills layout - ATS-friendly */
      .skills-grid { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 18px;
        padding-left: 45px;
      }
      .skill-column { }
      .skill-category { 
        font-size: 10.5pt; 
        font-weight: 700; 
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #2c3e50;
      }
      .skill-list { 
        list-style: none; 
        padding-left: 0;
      }
      .skill-list li { 
        padding: 2.5px 0; 
        font-size: 10pt;
        font-family: 'Calibri', 'Arial', sans-serif;
        line-height: 1.4;
      }
      .skill-list li:before { 
        content: "■ "; 
        color: #6c757d;
        margin-right: 5px;
        font-size: 8pt;
      }
      
      /* Lists with professional bullets */
      .content-list { 
        list-style: none; 
        padding-left: 45px;
      }
      .content-list li { 
        margin-bottom: 5px; 
        padding-left: 14px;
        position: relative;
        line-height: 1.5;
      }
      .content-list li:before { 
        content: "▪"; 
        position: absolute;
        left: 0;
        color: #495057;
        font-size: 10pt;
      }
      
      .stack { 
        list-style: none; 
        padding-left: 0;
        margin-bottom: 7px;
      }
      .stack li { 
        margin-bottom: 4px; 
        padding-left: 14px;
        position: relative;
        line-height: 1.5;
      }
      .stack li:before { 
        content: "•"; 
        position: absolute;
        left: 0;
        color: #6c757d;
        font-size: 9pt;
      }
      
      .muted { 
        color: #6c757d; 
        font-size: 9pt; 
        font-style: italic;
        margin-top: 4px;
        line-height: 1.4;
      }
      
      /* Print optimization */
      @media print {
        body { padding: 0.4in 0.6in; }
        .resume-section { page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="resume">
      ${contact.name ? `
      <header class="resume-header">
        <h1>${escapeHtml(contact.name)}</h1>
        ${contactContent}
      </header>` : ''}
      
      ${summaryHtml || jdSnippet ? `
      <section class="resume-section">
        <div class="section-header">
          <div class="section-rule"></div>
          <h2 class="section-title">Professional Summary</h2>
        </div>
        <div class="section-content">
          ${summaryHtml}
          ${jdSnippet}
        </div>
      </section>` : ''}
      
      ${allSkills.length > 0 ? `
      <section class="resume-section">
        <div class="section-header">
          <div class="section-rule"></div>
          <h2 class="section-title">Skills</h2>
        </div>
        <div class="skills-grid">
          ${buildSkillColumn(technicalSkills, "Technical Skills")}
          ${buildSkillColumn(softSkills, "Soft Skills")}
        </div>
      </section>` : ''}
      
      ${sections.experience.length > 0 ? `
      <section class="resume-section">
        <div class="section-header">
          <div class="section-rule"></div>
          <h2 class="section-title">Experience</h2>
        </div>
        <ul class="content-list">
          ${sections.experience.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>` : ''}
      
      ${sections.education.length > 0 ? `
      <section class="resume-section">
        <div class="section-header">
          <div class="section-rule"></div>
          <h2 class="section-title">Education</h2>
        </div>
        <ul class="content-list">
          ${sections.education.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>` : ''}
      
      ${sections.projects.length > 0 ? `
      <section class="resume-section">
        <div class="section-header">
          <div class="section-rule"></div>
          <h2 class="section-title">Projects</h2>
        </div>
        <ul class="content-list">
          ${sections.projects.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>` : ''}
      
      ${fallbackContent}
    </div>
  </body>
</html>`;
};

const buildPlainExportHtml = ({
  resumeDocument,
  resumeText = "",
  jobDescription = "",
  matchAnalysis,
  optimizations,
}) => {
  let sections = {};
  let contact = {};
  let bullets = [];

  if (resumeDocument && resumeDocument.header) {
    // Structured Data
    sections = {
      summary: [resumeDocument.summary].flat().filter(Boolean),
      skills: resumeDocument.skills || [],
      experience: resumeDocument.experience ? resumeDocument.experience.map(exp => {
        if (typeof exp === 'string') return exp;
        // For plain export, we want readable lines
        const desc = Array.isArray(exp.description) ? exp.description.join(". ") : exp.description;
        return `${exp.position || "Role"} at ${exp.company || "Company"} | ${desc}`;
      }) : [],
      education: resumeDocument.education ? resumeDocument.education.map(edu => {
        if (typeof edu === 'string') return edu;
        return `${edu.institution || ""} ${edu.degree || ""}`;
      }) : [],
      projects: resumeDocument.projects || []
    };

    contact = {
      name: resumeDocument.header.name,
      entries: [
        resumeDocument.header.email,
        resumeDocument.header.phone,
        resumeDocument.header.location,
        resumeDocument.header.linkedin
      ].filter(Boolean)
    };
    // For bullets in plain ATS, we might just use experience lines if specific bullets aren't separated nicely in the 'bullets' prop
    bullets = sections.experience;
  } else {
    const document = ensureResumeDocument(resumeDocument ?? resumeText);
    sections = deriveResumeSections(document.plainText);
    contact = buildContact(sections.contactLines);
    bullets = document.bullets.length > 0 ? document.bullets : sections.experience;
  }

  const summaryLines = sections.summary.length > 0 ? sections.summary : sections.experience.slice(0, 3);
  const experienceLines = sections.experience;
  const educationLines = sections.education;
  const skillsLines = sections.skills;
  const projectsLines = sections.projects;
  const bulletLines = bullets;

  const optimizationBullets = Array.isArray(optimizations)
    ? optimizations
      .map((item) =>
        item?.suggestion ? `• ${escapeHtml(item.section ? `${item.section}: ${item.suggestion}` : item.suggestion)}` : null,
      )
      .filter(Boolean)
      .slice(0, 5)
    : [];

  const formatPercentValue = (value) =>
    Number.isFinite(value) ? `${Math.round(value * 100)}%` : null;

  const metrics = [
    Number.isFinite(matchAnalysis?.score) ? `Score: ${Math.round(matchAnalysis.score)}/100` : null,
    formatPercentValue(matchAnalysis?.coverage) ? `Coverage: ${formatPercentValue(matchAnalysis.coverage)}` : null,
    formatPercentValue(matchAnalysis?.cosine) ? `Similarity: ${formatPercentValue(matchAnalysis.cosine)}` : null,
  ].filter(Boolean);

  const renderSection = (title, lines) => {
    if (!lines || lines.length === 0) return "";
    const content = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;
  };

  const renderListSection = (title, lines) => {
    if (!lines || lines.length === 0) return "";
    const content = lines.map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, "")) || ""}</li>`).join("");
    return `<section><h2>${escapeHtml(title)}</h2><ul>${content}</ul></section>`;
  };

  const contactLine = contact.entries.length > 0 ? contact.entries.join(" • ") : "";
  const jdPreview = jobDescription
    ? `<section><h2>Target Role</h2><p>${escapeHtml(jobDescription)}</p></section>`
    : "";

  const metricsLine = metrics.length > 0 ? `<p class="metrics">${metrics.map((item) => escapeHtml(item)).join(" • ")}</p>` : "";
  const optimizationsSection =
    optimizationBullets.length > 0
      ? `<section><h2>AI Suggestions</h2><ul>${optimizationBullets.join("")}</ul></section>`
      : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ATS Resume Export</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111827; background: #ffffff; }
      body { padding: 32px; }
      main { max-width: 720px; margin: 0 auto; display: grid; gap: 24px; }
      header { border-bottom: 2px solid #1f2937; padding-bottom: 16px; }
      h1 { margin: 0; font-size: 28px; letter-spacing: 0.02em; text-transform: uppercase; }
      h2 { margin: 24px 0 12px; font-size: 15px; letter-spacing: 0.18em; text-transform: uppercase; }
      p { margin: 0 0 12px; line-height: 1.6; }
      ul { margin: 0 0 12px 18px; padding: 0; line-height: 1.6; }
      li { margin-bottom: 6px; }
      .contact { font-size: 13px; color: #374151; }
      .metrics { font-size: 12px; color: #4b5563; text-transform: uppercase; letter-spacing: 0.2em; }
    </style>
  </head>
  <body>
    <main>
      ${contact.name ? `<header>
        <h1>${escapeHtml(contact.name)}</h1>
        ${contactLine ? `<p class="contact">${escapeHtml(contactLine)}</p>` : ''}
        ${metricsLine}
      </header>` : ''}
      ${renderSection("Summary", summaryLines)}
      ${renderListSection("Experience Highlights", bulletLines)}
      ${renderSection("Skills", skillsLines)}
      ${renderSection("Education", educationLines)}
      ${renderSection("Projects", projectsLines)}
      ${optimizationsSection}
      ${jdPreview}
    </main>
  </body>
</html>`;
};

const normalizeVariant = (variant = "styled") => {
  if (typeof variant !== "string") {
    return "styled";
  }
  const normalized = variant.trim().toLowerCase();
  if (["ats", "ats-plain", "ats_safe", "ats-safe", "plain", "plain-ats"].includes(normalized)) {
    return "ats-plain";
  }
  return "styled";
};

export const exportResumeToPdf = async ({
  resumeDocument,
  resumeText = "",
  jobDescription = "",
  matchAnalysis,
  optimizations,
  keywords,
  variant = "styled",
  skipPrint = false,
}) => {
  const payload = { resumeDocument, resumeText, jobDescription, matchAnalysis, optimizations, keywords };
  const normalizedVariant = normalizeVariant(variant);
  const html = normalizedVariant === "ats-plain" ? buildPlainExportHtml(payload) : buildExportHtml(payload);

  // If skipPrint is true, just return the HTML content
  if (skipPrint) {
    return html;
  }

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (!printWindow) {
    throw new Error('Please allow pop-ups to export PDF. Check your browser settings.');
  }

  try {
    // Write the HTML to the new window
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load
    await new Promise((resolve) => {
      if (printWindow.document.readyState === 'complete') {
        resolve();
      } else {
        printWindow.addEventListener('load', resolve);
      }
    });

    // Small delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Trigger the browser's native print dialog
    printWindow.print();

    // Close the window after a delay (user can cancel print)
    setTimeout(() => {
      printWindow.close();
    }, 1000);

    return true;
  } catch (error) {
    console.error('[PDF Export] Failed:', error);
    printWindow.close();
    throw new Error('Failed to open print dialog. Please try again.');
  }
};

export { buildExportHtml, buildPlainExportHtml, normalizeVariant };
