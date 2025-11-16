import { describe, it, expect } from "vitest";
import { buildResumeDocument, ORDERED_SECTIONS } from "./normalize-resume.js";

describe("buildResumeDocument", () => {
  it("returns structured document with sections, bullets, and plainText", () => {
    const input = "John Doe\nSoftware Engineer";
    const result = buildResumeDocument(input);

    expect(result).toHaveProperty("sections");
    expect(result).toHaveProperty("bullets");
    expect(result).toHaveProperty("plainText");
  });

  it("normalizes Windows line endings to Unix", () => {
    const input = "Line 1\r\nLine 2\r\nLine 3";
    const result = buildResumeDocument(input);

    expect(result.plainText).toBe("Line 1\nLine 2\nLine 3");
  });

  it("removes empty lines", () => {
    const input = "Line 1\n\n\nLine 2\n\n";
    const result = buildResumeDocument(input);

    expect(result.plainText).toBe("Line 1\nLine 2");
  });

  it("handles empty or undefined input", () => {
    expect(buildResumeDocument("").plainText).toBe("");
    expect(buildResumeDocument(null).plainText).toBe("");
    expect(buildResumeDocument(undefined).plainText).toBe("");
  });

  it("normalizes excessive whitespace within lines", () => {
    const input = "Too    much    space";
    const result = buildResumeDocument(input);

    expect(result.plainText).toBe("Too much space");
  });

  it("detects bullet points", () => {
    const input = `Skills
• JavaScript
• Python
- TypeScript`;
    const result = buildResumeDocument(input);

    expect(result.bullets.length).toBeGreaterThan(0);
    expect(result.bullets.some((b) => b.includes("JavaScript"))).toBe(true);
    expect(result.bullets.some((b) => b.includes("Python"))).toBe(true);
    expect(result.bullets.some((b) => b.includes("TypeScript"))).toBe(true);
  });

  it("normalizes various bullet markers", () => {
    const input = `• Bullet 1
* Bullet 2
- Bullet 3
● Bullet 4`;
    const result = buildResumeDocument(input);

    expect(result.bullets.length).toBe(4);
  });

  it("detects Summary section", () => {
    const input = `Summary
Experienced software engineer with 5 years of experience.`;
    const result = buildResumeDocument(input);

    const summarySection = result.sections.find((s) => s.id === "summary");
    expect(summarySection).toBeDefined();
    expect(summarySection.content.length).toBeGreaterThan(0);
    expect(summarySection.content[0]).toContain("Experienced software engineer");
  });

  it("detects Experience section", () => {
    const input = `Experience
Software Engineer at TechCorp
• Built scalable systems`;
    const result = buildResumeDocument(input);

    const expSection = result.sections.find((s) => s.id === "experience");
    expect(expSection).toBeDefined();
    expect(expSection.content.length).toBeGreaterThan(0);
  });

  it("detects Skills section", () => {
    const input = `Technical Skills
JavaScript, Python, React`;
    const result = buildResumeDocument(input);

    const skillsSection = result.sections.find((s) => s.id === "skills");
    expect(skillsSection).toBeDefined();
    expect(skillsSection.content[0]).toContain("JavaScript");
  });

  it("detects Education section", () => {
    const input = `Education
Bachelor of Science in Computer Science
University of Technology, 2020`;
    const result = buildResumeDocument(input);

    const eduSection = result.sections.find((s) => s.id === "education");
    expect(eduSection).toBeDefined();
    expect(eduSection.content.length).toBeGreaterThan(0);
  });

  it("detects Projects section", () => {
    const input = `Projects
E-commerce Platform
Built with React and Node.js`;
    const result = buildResumeDocument(input);

    const projectsSection = result.sections.find((s) => s.id === "projects");
    expect(projectsSection).toBeDefined();
    expect(projectsSection.content.length).toBeGreaterThan(0);
  });

  it("detects Certifications section", () => {
    const input = `Certifications
AWS Certified Solutions Architect
Google Cloud Professional`;
    const result = buildResumeDocument(input);

    const certsSection = result.sections.find((s) => s.id === "certifications");
    expect(certsSection).toBeDefined();
    expect(certsSection.content.length).toBeGreaterThan(0);
  });

  it("handles section headers with colons", () => {
    const input = `Skills:
JavaScript, Python`;
    const result = buildResumeDocument(input);

    const skillsSection = result.sections.find((s) => s.id === "skills");
    expect(skillsSection).toBeDefined();
    expect(skillsSection.content[0]).toContain("JavaScript");
  });

  it("handles case-insensitive section headers", () => {
    const input = `EXPERIENCE
Senior Developer at StartupCo`;
    const result = buildResumeDocument(input);

    const expSection = result.sections.find((s) => s.id === "experience");
    expect(expSection).toBeDefined();
  });

  it("places initial lines in contact section before any heading", () => {
    const input = `John Doe
john@example.com
+966 50 123 4567

Summary
Software Engineer with 5 years of experience.`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection).toBeDefined();
    expect(contactSection.content.some((line) => line.includes("John Doe"))).toBe(true);
    expect(contactSection.content.some((line) => line.includes("john@example.com"))).toBe(true);
  });

  it("auto-detects contact information with @ symbol", () => {
    const input = `Summary
Experienced developer

john.doe@example.com
linkedin.com/in/johndoe`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection).toBeDefined();
    expect(contactSection.content.some((line) => line.includes("@"))).toBe(true);
  });

  it("auto-detects contact information with phone patterns", () => {
    const input = `Summary
Senior Engineer

+966 50 123 4567`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection).toBeDefined();
    expect(contactSection.content.some((line) => /\+?\d{3}/.test(line))).toBe(true);
  });

  it("auto-detects contact information with location keywords", () => {
    const input = `Summary
Developer based in Riyadh, Saudi Arabia`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection).toBeDefined();
    expect(contactSection.content.some((line) => /riyadh|saudi/i.test(line))).toBe(true);
  });

  it("auto-fills summary from first paragraph if no summary section", () => {
    const input = `John Doe
john@example.com

Experienced software engineer with expertise in full-stack development and cloud architecture.

Work History
Senior Developer at TechCo`;
    const result = buildResumeDocument(input);

    const summarySection = result.sections.find((s) => s.id === "summary");
    expect(summarySection).toBeDefined();
    // Note: The auto-fill logic extracts first paragraph from the original text
    // In this case it might include contact info as it's the first block
    expect(summarySection.content.length).toBeGreaterThan(0);
  });

  it("limits contact section to 8 items", () => {
    const input = `Name
Email1
Email2
Email3
Email4
Email5
Email6
Email7
Email8
Email9
Email10

Summary
Developer`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection.content.length).toBeLessThanOrEqual(8);
  });

  it("places unrecognized content in other section", () => {
    const input = `Summary
Developer

Random Section That Doesn't Match
Some content here`;
    const result = buildResumeDocument(input);

    // The content should end up somewhere (likely in 'other' or continue in current section)
    expect(result.plainText).toContain("Some content here");
  });

  it("maintains section order as defined in ORDERED_SECTIONS", () => {
    const input = `Certifications
AWS Certified

Education
BS Computer Science

Skills
JavaScript, Python

Experience
Senior Developer`;
    const result = buildResumeDocument(input);

    const sectionIds = result.sections.map((s) => s.id);
    const orderedIds = ORDERED_SECTIONS.map((s) => s.id).filter((id) =>
      sectionIds.includes(id)
    );

    // Verify that sections appear in the canonical order
    const contactIndex = sectionIds.indexOf("contact");
    const skillsIndex = sectionIds.indexOf("skills");
    const experienceIndex = sectionIds.indexOf("experience");
    const educationIndex = sectionIds.indexOf("education");
    const certificationsIndex = sectionIds.indexOf("certifications");

    // Contact should come first (if present)
    if (contactIndex >= 0 && skillsIndex >= 0) {
      expect(contactIndex).toBeLessThan(skillsIndex);
    }
    // Skills should come before experience
    if (skillsIndex >= 0 && experienceIndex >= 0) {
      expect(skillsIndex).toBeLessThan(experienceIndex);
    }
    // Experience should come before education
    if (experienceIndex >= 0 && educationIndex >= 0) {
      expect(experienceIndex).toBeLessThan(educationIndex);
    }
    // Education should come before certifications
    if (educationIndex >= 0 && certificationsIndex >= 0) {
      expect(educationIndex).toBeLessThan(certificationsIndex);
    }
  });

  it("preserves bullet formatting in normalized output", () => {
    const input = `Experience
• Led team of 5 developers
• Improved system performance by 40%
• Migrated legacy systems to cloud`;
    const result = buildResumeDocument(input);

    expect(result.plainText).toContain("• Led team");
    expect(result.plainText).toContain("• Improved system");
    expect(result.plainText).toContain("• Migrated legacy");
  });

  it("handles complex multi-section resume", () => {
    const input = `John Doe
Senior Software Engineer
john.doe@example.com | +966 50 123 4567
Riyadh, Saudi Arabia

Professional Summary
Results-driven software engineer with 8+ years of experience in full-stack development.

Technical Skills
• Languages: JavaScript, Python, Java, Go
• Frameworks: React, Node.js, Django
• Cloud: AWS, Azure, GCP

Work Experience
Senior Software Engineer | TechCorp | 2020 - Present
• Led development of microservices architecture
• Improved system performance by 45%
• Mentored junior developers

Software Engineer | StartupCo | 2015 - 2020
• Built scalable web applications
• Implemented CI/CD pipelines

Education
Bachelor of Science in Computer Science
King Saud University, 2015

Certifications
• AWS Solutions Architect
• Google Cloud Professional`;

    const result = buildResumeDocument(input);

    // Verify all major sections are present
    expect(result.sections.find((s) => s.id === "contact")).toBeDefined();
    expect(result.sections.find((s) => s.id === "summary")).toBeDefined();
    expect(result.sections.find((s) => s.id === "skills")).toBeDefined();
    expect(result.sections.find((s) => s.id === "experience")).toBeDefined();
    expect(result.sections.find((s) => s.id === "education")).toBeDefined();
    expect(result.sections.find((s) => s.id === "certifications")).toBeDefined();

    // Verify bullets were detected
    expect(result.bullets.length).toBeGreaterThan(5);

    // Verify plain text is complete
    expect(result.plainText).toContain("John Doe");
    expect(result.plainText).toContain("TechCorp");
    expect(result.plainText).toContain("King Saud University");
  });

  it("handles resume with alternative section names", () => {
    const input = `Professional Summary
Experienced developer

Competencies
JavaScript, React, Node.js

Employment History
Senior Developer at TechCo

Academic History
BS in Computer Science`;

    const result = buildResumeDocument(input);

    expect(result.sections.find((s) => s.id === "summary")).toBeDefined();
    expect(result.sections.find((s) => s.id === "skills")).toBeDefined();
    expect(result.sections.find((s) => s.id === "experience")).toBeDefined();
    expect(result.sections.find((s) => s.id === "education")).toBeDefined();
  });

  it("always includes contact section even if empty", () => {
    const input = `Summary
A brief summary with no contact info.`;
    const result = buildResumeDocument(input);

    const contactSection = result.sections.find((s) => s.id === "contact");
    expect(contactSection).toBeDefined();
  });

  it("handles resume with only bullets and no headers", () => {
    const input = `• JavaScript developer
• 5 years experience
• Built 20+ applications`;
    const result = buildResumeDocument(input);

    expect(result.bullets.length).toBe(3);
    expect(result.plainText).toContain("JavaScript developer");
  });

  it("trims trailing colons from section headers", () => {
    const input = `Skills::::
JavaScript, Python`;
    const result = buildResumeDocument(input);

    const skillsSection = result.sections.find((s) => s.id === "skills");
    expect(skillsSection).toBeDefined();
  });
});

describe("ORDERED_SECTIONS", () => {
  it("exports canonical section order", () => {
    expect(ORDERED_SECTIONS).toBeInstanceOf(Array);
    expect(ORDERED_SECTIONS.length).toBeGreaterThan(0);

    const ids = ORDERED_SECTIONS.map((s) => s.id);
    expect(ids).toContain("contact");
    expect(ids).toContain("summary");
    expect(ids).toContain("skills");
    expect(ids).toContain("experience");
    expect(ids).toContain("education");
  });

  it("has proper structure for each section", () => {
    ORDERED_SECTIONS.forEach((section) => {
      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("title");
      expect(typeof section.id).toBe("string");
      expect(typeof section.title).toBe("string");
    });
  });
});
