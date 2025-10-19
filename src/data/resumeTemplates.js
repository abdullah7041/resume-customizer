// src/data/resumeTemplates.js
// ATS-friendly resume templates with structured sections

export const TEMPLATE_CATEGORIES = {
  MODERN: "modern",
  CLASSIC: "classic",
  TECHNICAL: "technical",
  CREATIVE: "creative",
  EXECUTIVE: "executive"
};

export const resumeTemplates = [
  {
    id: "modern-professional",
    name: "Modern Professional",
    category: TEMPLATE_CATEGORIES.MODERN,
    description: "Clean, contemporary design with clear section headers. Perfect for tech and corporate roles.",
    atsScore: 95,
    preview: {
      layout: "single-column",
      colorScheme: "emerald",
      font: "sans-serif"
    },
    structure: {
      header: {
        includePhoto: false,
        layout: "centered",
        fields: ["name", "title", "contact", "linkedin", "portfolio"]
      },
      sections: [
        {
          id: "summary",
          title: "Professional Summary",
          type: "paragraph",
          placeholder: "Results-driven professional with X+ years of experience in [Industry]. Proven track record of [Key Achievement]. Skilled in [Core Skills].",
          maxLength: 300,
          required: true
        },
        {
          id: "experience",
          title: "Work Experience",
          type: "timeline",
          placeholder: "Company Name | Job Title | Start Date - End Date\n• Achievement-focused bullet point\n• Quantified result with metrics",
          required: true,
          format: {
            showDuration: true,
            bulletStyle: "filled-circle"
          }
        },
        {
          id: "skills",
          title: "Core Skills",
          type: "grid",
          placeholder: "Skill 1, Skill 2, Skill 3",
          format: {
            columns: 3,
            showProficiency: false
          }
        },
        {
          id: "education",
          title: "Education",
          type: "timeline",
          placeholder: "University Name | Degree | Graduation Year",
          format: {
            showGPA: true,
            showHonors: true
          }
        },
        {
          id: "certifications",
          title: "Certifications",
          type: "list",
          placeholder: "Certification Name - Issuing Organization (Year)",
          optional: true
        }
      ]
    },
    formatting: {
      fontSize: {
        name: "28pt",
        sectionTitle: "14pt",
        body: "11pt"
      },
      spacing: {
        sectionGap: "16px",
        lineHeight: "1.5"
      },
      colors: {
        primary: "#0ea472",
        secondary: "#075951",
        text: "#1f2937"
      }
    }
  },
  
  {
    id: "classic-traditional",
    name: "Classic Traditional",
    category: TEMPLATE_CATEGORIES.CLASSIC,
    description: "Traditional resume format with emphasis on chronological experience. Ideal for conservative industries.",
    atsScore: 98,
    preview: {
      layout: "single-column",
      colorScheme: "neutral",
      font: "serif"
    },
    structure: {
      header: {
        includePhoto: false,
        layout: "left-aligned",
        fields: ["name", "address", "phone", "email"]
      },
      sections: [
        {
          id: "objective",
          title: "Career Objective",
          type: "paragraph",
          placeholder: "Seeking a challenging position in [Field] where I can utilize my [Skills] to contribute to [Goal].",
          maxLength: 200,
          optional: true
        },
        {
          id: "experience",
          title: "Professional Experience",
          type: "timeline",
          placeholder: "Job Title\nCompany Name, City, State\nStart Date - End Date\n• Accomplishment with measurable result\n• Responsibility description",
          required: true,
          format: {
            showDuration: false,
            bulletStyle: "dash",
            reverse: true
          }
        },
        {
          id: "education",
          title: "Education",
          type: "timeline",
          placeholder: "Degree Type in Major\nUniversity Name, City, State\nGraduation Date",
          required: true,
          format: {
            showGPA: true
          }
        },
        {
          id: "skills",
          title: "Professional Skills",
          type: "categorized",
          placeholder: "Category: Skill 1, Skill 2, Skill 3",
          format: {
            categories: ["Technical", "Soft Skills", "Languages"]
          }
        },
        {
          id: "references",
          title: "References",
          type: "text",
          placeholder: "Available upon request",
          optional: true
        }
      ]
    },
    formatting: {
      fontSize: {
        name: "24pt",
        sectionTitle: "12pt",
        body: "11pt"
      },
      spacing: {
        sectionGap: "12px",
        lineHeight: "1.4"
      },
      colors: {
        primary: "#000000",
        secondary: "#333333",
        text: "#000000"
      }
    }
  },
  
  {
    id: "technical-engineer",
    name: "Technical Engineer",
    category: TEMPLATE_CATEGORIES.TECHNICAL,
    description: "Optimized for software developers, engineers, and IT professionals. Highlights technical skills and projects.",
    atsScore: 96,
    preview: {
      layout: "two-column",
      colorScheme: "blue",
      font: "monospace"
    },
    structure: {
      header: {
        includePhoto: false,
        layout: "centered",
        fields: ["name", "title", "email", "phone", "github", "linkedin", "portfolio"]
      },
      sections: [
        {
          id: "summary",
          title: "Technical Summary",
          type: "paragraph",
          placeholder: "Software Engineer with X years building scalable systems using [Technologies]. Expertise in [Domain] with focus on [Specialization].",
          maxLength: 250,
          required: true
        },
        {
          id: "technical-skills",
          title: "Technical Skills",
          type: "categorized",
          placeholder: "Languages: JavaScript, Python, Java\nFrameworks: React, Node.js, Django\nTools: Git, Docker, AWS",
          required: true,
          format: {
            categories: ["Languages", "Frameworks", "Tools", "Databases", "Cloud/DevOps"]
          }
        },
        {
          id: "experience",
          title: "Professional Experience",
          type: "timeline",
          placeholder: "Senior Software Engineer | Company | Date Range\n• Built [Feature] using [Technology] resulting in [Metric]\n• Optimized [System] achieving [Performance Improvement]",
          required: true,
          format: {
            showDuration: true,
            bulletStyle: "arrow",
            emphasizeTech: true
          }
        },
        {
          id: "projects",
          title: "Key Projects",
          type: "showcase",
          placeholder: "Project Name | Tech Stack | GitHub Link\nDescription of project impact and technical challenges solved.",
          format: {
            showLinks: true,
            showTechStack: true
          }
        },
        {
          id: "education",
          title: "Education & Certifications",
          type: "timeline",
          placeholder: "BS Computer Science | University | Year\nAWS Certified Solutions Architect | Amazon | Year",
          format: {
            combinedSection: true
          }
        }
      ]
    },
    formatting: {
      fontSize: {
        name: "26pt",
        sectionTitle: "13pt",
        body: "10.5pt"
      },
      spacing: {
        sectionGap: "14px",
        lineHeight: "1.45"
      },
      colors: {
        primary: "#2563eb",
        secondary: "#1e40af",
        text: "#111827"
      }
    }
  },
  
  {
    id: "creative-designer",
    name: "Creative Designer",
    category: TEMPLATE_CATEGORIES.CREATIVE,
    description: "Visually appealing layout for creative professionals. Perfect for designers, marketers, and content creators.",
    atsScore: 85,
    preview: {
      layout: "asymmetric",
      colorScheme: "gradient",
      font: "modern-sans"
    },
    structure: {
      header: {
        includePhoto: true,
        layout: "sidebar",
        fields: ["name", "title", "tagline", "email", "portfolio", "behance", "instagram"]
      },
      sections: [
        {
          id: "about",
          title: "About Me",
          type: "paragraph",
          placeholder: "Creative professional passionate about [Field]. I bring ideas to life through [Medium/Approach]. My work focuses on [Style/Philosophy].",
          maxLength: 250,
          required: true
        },
        {
          id: "expertise",
          title: "Areas of Expertise",
          type: "tags",
          placeholder: "UI/UX Design, Brand Identity, Digital Marketing",
          format: {
            style: "pills",
            colorful: true
          }
        },
        {
          id: "experience",
          title: "Experience Highlights",
          type: "showcase",
          placeholder: "Lead Designer | Agency Name | Duration\n• Campaign that achieved [Result]\n• Redesign increasing [Metric] by X%",
          required: true,
          format: {
            showImages: true,
            emphasizeResults: true
          }
        },
        {
          id: "portfolio",
          title: "Featured Work",
          type: "gallery",
          placeholder: "Project Name | Client | Year\nBrief description of project goals and creative approach.",
          format: {
            showThumbnails: true,
            linkToPortfolio: true
          }
        },
        {
          id: "tools",
          title: "Design Tools",
          type: "grid",
          placeholder: "Adobe Creative Suite, Figma, Sketch, Webflow",
          format: {
            showIcons: true,
            columns: 4
          }
        },
        {
          id: "education",
          title: "Education",
          type: "simple-list",
          placeholder: "BFA Graphic Design | Art Institute | Year"
        }
      ]
    },
    formatting: {
      fontSize: {
        name: "32pt",
        sectionTitle: "16pt",
        body: "11pt"
      },
      spacing: {
        sectionGap: "20px",
        lineHeight: "1.6"
      },
      colors: {
        primary: "#ec4899",
        secondary: "#8b5cf6",
        accent: "#f59e0b",
        text: "#374151"
      }
    }
  },
  
  {
    id: "executive-leadership",
    name: "Executive Leadership",
    category: TEMPLATE_CATEGORIES.EXECUTIVE,
    description: "High-impact format for senior executives and leadership roles. Emphasizes strategic achievements and business results.",
    atsScore: 93,
    preview: {
      layout: "single-column",
      colorScheme: "sophisticated",
      font: "serif-pro"
    },
    structure: {
      header: {
        includePhoto: false,
        layout: "centered-formal",
        fields: ["name", "title", "email", "phone", "linkedin"]
      },
      sections: [
        {
          id: "executive-summary",
          title: "Executive Profile",
          type: "paragraph",
          placeholder: "Strategic executive with 15+ years driving business transformation and revenue growth across [Industries]. Proven success leading [Size] teams and managing $XXM+ budgets. Core competencies in [Areas].",
          maxLength: 400,
          required: true
        },
        {
          id: "core-competencies",
          title: "Core Competencies",
          type: "grid",
          placeholder: "Strategic Planning | P&L Management | Team Leadership | M&A | Digital Transformation | Change Management",
          format: {
            columns: 3,
            separator: "|",
            bold: true
          }
        },
        {
          id: "professional-experience",
          title: "Professional Experience",
          type: "timeline",
          placeholder: "Chief Operating Officer | Company Name | Years\n\nKey Achievements:\n• Drove revenue growth from $XXM to $XXM (XX% increase) through strategic initiatives\n• Led organizational restructure optimizing operations and reducing costs by $XXM\n• Spearheaded digital transformation initiative impacting XX,XXX+ customers",
          required: true,
          format: {
            emphasizeNumbers: true,
            showCompanyDescription: true,
            achievementFocus: true
          }
        },
        {
          id: "education",
          title: "Education & Credentials",
          type: "formal",
          placeholder: "MBA, Strategy & Finance | Harvard Business School | Year\nBS Business Administration | Stanford University | Year\n\nBoard Certifications: [Credentials]",
          format: {
            showHonors: true,
            showAdditionalCredentials: true
          }
        },
        {
          id: "board-affiliations",
          title: "Board Positions & Affiliations",
          type: "list",
          placeholder: "Board Member, [Organization Name] | Year-Present\nAdvisory Board, [Company] | Year-Year",
          optional: true
        }
      ]
    },
    formatting: {
      fontSize: {
        name: "30pt",
        sectionTitle: "14pt",
        body: "11pt"
      },
      spacing: {
        sectionGap: "18px",
        lineHeight: "1.5"
      },
      colors: {
        primary: "#1e293b",
        secondary: "#475569",
        accent: "#0ea472",
        text: "#0f172a"
      }
    }
  }
];

/**
 * Get template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Template object
 */
export const getTemplateById = (id) => {
  return resumeTemplates.find(template => template.id === id) || null;
};

/**
 * Get templates by category
 * @param {string} category - Template category
 * @returns {Array} Array of templates
 */
export const getTemplatesByCategory = (category) => {
  return resumeTemplates.filter(template => template.category === category);
};

/**
 * Get all template categories
 * @returns {Array} Array of category names
 */
export const getAllCategories = () => {
  return Object.values(TEMPLATE_CATEGORIES);
};

/**
 * Calculate template match score based on resume content
 * @param {Object} template - Template object
 * @param {Object} resumeData - Resume data
 * @returns {number} Match score 0-100
 */
export const calculateTemplateMatch = (template, resumeData) => {
  let score = 0;
  const sections = template.structure.sections;
  
  // Check which required sections are present in resume
  const requiredSections = sections.filter(s => s.required);
  const matchedSections = requiredSections.filter(s => {
    const sectionId = s.id;
    return resumeData[sectionId] && resumeData[sectionId].length > 0;
  });
  
  // Base score from section match
  score += (matchedSections.length / requiredSections.length) * 60;
  
  // Bonus for optional sections
  const optionalSections = sections.filter(s => s.optional);
  const matchedOptional = optionalSections.filter(s => {
    return resumeData[s.id] && resumeData[s.id].length > 0;
  });
  score += (matchedOptional.length / Math.max(optionalSections.length, 1)) * 20;
  
  // ATS score contributes to final score
  score += (template.atsScore / 100) * 20;
  
  return Math.round(Math.min(score, 100));
};

export default resumeTemplates;
