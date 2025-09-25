import { buildResumeDocument } from "../../shared/normalize-resume.js";

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

const normalize = (value) => value.replace(/\s+/g, " ").trim();

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
    .filter(Boolean);

const sanitizeLines = (items) =>
  Array.isArray(items)
    ? items.map((item) => normalize(String(item ?? ""))).filter(Boolean)
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

const buildList = (items, className) => {
  if (!items || items.length === 0) {
    return '<p class="muted">No details provided.</p>';
  }
  const listItems = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return `<ul class="${className}">${listItems}</ul>`;
};

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

  if (fragments.length === 0) {
    fragments.push('<p class="muted">Add a short professional summary.</p>');
  }

  return fragments.join("");
};

const buildSkills = (skills, keywords) => {
  const merged = new Set(skills);
  if (keywords?.add) {
    for (const token of keywords.add) {
      if (merged.size >= 30) break;
      merged.add(token);
    }
  }
  if (merged.size === 0) {
    return '<p class="muted">Highlight your core tools and strengths.</p>';
  }
  return `<ul class="skills">${Array.from(merged)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
};

const buildSection = (title, content) => `
  <section class="section">
    <h2>${escapeHtml(title)}</h2>
    ${content}
  </section>
`;

const buildContact = (lines) => {
  if (!lines || lines.length === 0) {
    return { name: "AI Resume Export", entries: [] };
  }
  const [primary, ...rest] = lines;
  return {
    name: primary,
    entries: rest,
  };
};

const buildExportHtml = ({ resumeDocument, resumeText = "", jobDescription = "", matchAnalysis, optimizations, keywords }) => {
  const document = ensureResumeDocument(resumeDocument ?? resumeText);
  const sections = deriveResumeSections(document.plainText);
  const contact = buildContact(sections.contactLines);
  const summaryHtml = buildSummary(sections.summary, matchAnalysis, optimizations);
  const skillsHtml = buildSkills(sections.skills, keywords);
  const experienceHtml = buildList(sections.experience, "stack");
  const educationHtml = buildList(sections.education, "stack");
  const projectsHtml = buildList(sections.projects, "stack");
  const jdSnippet = jobDescription ? `<p class="muted">Target role context: ${escapeHtml(jobDescription.slice(0, 240))}${
    jobDescription.length > 240 ? "…" : ""
  }</p>` : "";

  const contactContent =
    contact.entries.length > 0
      ? `<ul class="contact-list">${contact.entries.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : '<p class="muted">Add an email, phone, and LinkedIn to this section.</p>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Resume Export</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; font-family: 'Inter', 'Tajawal', system-ui, -apple-system, sans-serif; color: #111827; background: #ffffff; }
      body { padding: 32px; }
      @media print { body { margin: 0; padding: 24px; } }
      .page { max-width: 210mm; margin: 0 auto; background: #ffffff; border: 1px solid #d1d5db; padding: 32px 40px; }
      .page-header { border-bottom: 1px solid #d1d5db; padding-bottom: 16px; margin-bottom: 24px; }
      .page-header h1 { font-size: 28px; letter-spacing: 0.02em; margin: 0; text-transform: uppercase; }
      .contact-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 12px; color: #334155; }
      .section { margin-bottom: 20px; }
      .section h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.22em; margin-bottom: 10px; color: #0b6b3a; }
      .section p { margin: 0 0 8px; line-height: 1.6; font-size: 13px; }
      .stack { list-style: disc; padding-left: 20px; margin: 0; display: grid; gap: 6px; font-size: 13px; line-height: 1.5; }
      .stack li { padding-left: 4px; }
      .skills { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 12px; }
      .skills li { background: rgba(11, 107, 58, 0.08); color: #0b5335; padding: 4px 10px; border-radius: 999px; }
      .muted { color: #475569; font-size: 12px; }
    </style>
  </head>
  <body>
    <article class="page">
      <header class="page-header">
        <h1>${escapeHtml(contact.name)}</h1>
      </header>
      ${buildSection("Contact", contactContent)}
      ${buildSection("Summary", summaryHtml + jdSnippet)}
      ${buildSection("Skills", skillsHtml)}
      ${buildSection("Experience", experienceHtml)}
      ${buildSection("Education", educationHtml)}
      ${buildSection("Projects", projectsHtml)}
    </article>
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
  const document = ensureResumeDocument(resumeDocument ?? resumeText);
  const sections = deriveResumeSections(document.plainText);
  const contact = buildContact(sections.contactLines);
  const summaryLines = sections.summary.length > 0 ? sections.summary : sections.experience.slice(0, 3);
  const experienceLines = sections.experience;
  const educationLines = sections.education;
  const skillsLines = sections.skills;
  const projectsLines = sections.projects;
  const bulletLines = document.bullets.length > 0 ? document.bullets : experienceLines;
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
    const content = lines.map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, ""))}</li>`).join("");
    return `<section><h2>${escapeHtml(title)}</h2><ul>${content}</ul></section>`;
  };

  const contactLine = contact.entries.length > 0 ? contact.entries.join(" • ") : "Add contact information.";
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
      <header>
        <h1>${escapeHtml(contact.name)}</h1>
        <p class="contact">${escapeHtml(contactLine)}</p>
        ${metricsLine}
      </header>
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

const triggerPrint = (html) => {
  if (typeof document === "undefined") {
    throw new Error("Export is only available in the browser.");
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const remove = () => {
    iframe.parentNode?.removeChild(iframe);
  };

  const frameDocument = iframe.contentWindow?.document || iframe.contentDocument;
  if (!frameDocument) {
    remove();
    throw new Error("Unable to prepare export frame.");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  setTimeout(() => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      remove();
      return;
    }
    frameWindow.focus();
    frameWindow.print();
    setTimeout(remove, 800);
  }, 220);
};

export const exportResumeToPdf = ({
  resumeDocument,
  resumeText = "",
  jobDescription = "",
  matchAnalysis,
  optimizations,
  keywords,
  variant = "styled",
}) => {
  const payload = { resumeDocument, resumeText, jobDescription, matchAnalysis, optimizations, keywords };
  const html = variant === "ats" ? buildPlainExportHtml(payload) : buildExportHtml(payload);
  triggerPrint(html);
  return true;
};

export { buildExportHtml, buildPlainExportHtml };
