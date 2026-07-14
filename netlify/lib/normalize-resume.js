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
    "work history",
  ],
  education: ["education", "academic history", "academics", "training"],
  projects: ["projects", "selected projects", "key projects", "portfolio"],
  certifications: ["certifications", "certificates", "licenses", "accreditations"],
};

const ORDERED_SECTIONS = [
  { id: "contact", title: "Contact" },
  { id: "summary", title: "Summary" },
  { id: "skills", title: "Skills" },
  { id: "experience", title: "Experience" },
  { id: "education", title: "Education" },
  { id: "projects", title: "Projects" },
  { id: "certifications", title: "Certifications" },
  { id: "other", title: "Other" },
];

const BULLET_PATTERN = /^[\s>*•●◦‣▪·-]+/u;

const normalizeWhitespace = (value = "") => value.replace(/\s+/g, " ").trim();

const detectSection = (line) => {
  const normalized = normalizeWhitespace(line)
    .toLowerCase()
    .replace(/[:.]+$/, "");
  for (const [key, aliases] of Object.entries(SECTION_KEYWORDS)) {
    if (aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))) {
      return key;
    }
  }
  return null;
};

const normalizeLine = (line) => {
  if (!line) return "";
  const trimmed = line.replace(/\r/g, "").trim();
  if (!trimmed) return "";
  if (BULLET_PATTERN.test(trimmed)) {
    const marker = trimmed.match(BULLET_PATTERN)?.[0] ?? "";
    const content = trimmed.slice(marker.length);
    const normalizedContent = normalizeWhitespace(content);
    return `${marker.replace(/\s+/g, " ").trim()} ${normalizedContent}`.trim();
  }
  return normalizeWhitespace(trimmed);
};

const deriveSections = (lines, plainText) => {
  const sections = {
    contact: [],
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    other: [],
  };

  let current = "summary";
  let encounteredHeading = false;

  for (const line of lines) {
    const heading = detectSection(line);
    if (heading) {
      current = heading;
      encounteredHeading = true;
      continue;
    }

    if (!encounteredHeading && sections.contact.length < 6) {
      sections.contact.push(line);
      continue;
    }

    if (current === "contact") {
      if (sections.contact.length < 8) {
        sections.contact.push(line);
      }
      continue;
    }

    if (!sections[current]) {
      current = "other";
    }

    sections[current].push(line);
  }

  if (sections.summary.length === 0 && plainText) {
    const paragraphs = plainText
      .split(/\n{2,}/)
      .map((segment) => normalizeWhitespace(segment))
      .filter(Boolean);
    if (paragraphs.length > 0) {
      sections.summary.push(paragraphs[0]);
    }
  }

  if (sections.contact.length < 3 && plainText) {
    const candidates = plainText
      .split(/\n/)
      .map((segment) => normalizeWhitespace(segment))
      .filter((segment) =>
        /@|\b(?:linkedin|github|behance|riyadh|ksa|saudi)\b|\+?\d{3}/i.test(segment),
      );
    const seenContacts = new Set(sections.contact);
    for (const candidate of candidates) {
      if (!seenContacts.has(candidate) && sections.contact.length < 8) {
        sections.contact.push(candidate);
        seenContacts.add(candidate);
      }
    }
  }

  const compacted = ORDERED_SECTIONS.map(({ id, title }) => ({
    id,
    title,
    content: sections[id] ?? [],
  })).filter((section) => section.content.length > 0 || section.id === "contact");

  return compacted;
};

export const buildResumeDocument = (input = "") => {
  const raw = typeof input === "string" ? input : "";
  const normalizedNewlines = raw.replace(/\r\n/g, "\n");
  const lines = normalizedNewlines
    .split(/\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const plainText = lines.join("\n");
  const bullets = lines.filter((line) => BULLET_PATTERN.test(line));
  const sections = deriveSections(lines, normalizedNewlines);

  return { sections, bullets, plainText };
};

export { ORDERED_SECTIONS };
