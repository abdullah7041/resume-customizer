// src/components/TemplateRenderer.jsx
// Renders resume templates with user data injection

import { useMemo } from "react";
import { cn } from "../../lib/utils/cn";
import { ExternalLink, Github, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { getTemplate } from "./registry";
import type { TemplateId } from "../../types/templates";

// Helper to safely render a value (handles strings, objects, arrays, and React Elements)
import { isValidElement } from "react";

const safeRender = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (isValidElement(value)) return value; // Allow React components (for Diffs)
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      if (isValidElement(item)) return <span key={i}>{item}</span>;
      if (typeof item === "string") return item;
      if (typeof item === "object") {
        return item.name || item.title || item.institution || item.text || JSON.stringify(item);
      }
      return String(item);
    }).reduce((prev, curr) => [prev, ", ", curr]); // Join with commas for arrays of elements
  }
  if (typeof value === "object") {
    return value.name || value.title || value.institution || value.text || JSON.stringify(value);
  }
  return String(value);
};

const ContactIcon = ({ type }) => {

  const icons = {
    email: Mail,
    phone: Phone,
    linkedin: Linkedin,
    github: Github,
    portfolio: ExternalLink,
    address: MapPin
  };

  const Icon = icons[type] || ExternalLink;
  return <Icon className="w-4 h-4" />;
};

const TemplateHeader = ({ template, userData }) => {
  const { header } = template.structure;
  const { layout, fields } = header;

  const layoutClasses = {
    centered: "text-center",
    "left-aligned": "text-left",
    sidebar: "flex items-center gap-6",
    "centered-formal": "text-center border-b-2 pb-4"
  };

  return (
    <div className={cn("mb-6", layoutClasses[layout])}>
      {header.includePhoto && userData.photo && (
        <img
          src={userData.photo}
          alt={userData.name || "Profile"}
          className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500"
        />
      )}

      <div className="flex-1">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {userData.name || "Your Name"}
        </h1>

        {userData.title && (
          <p className="text-xl text-emerald-600 dark:text-emerald-400 font-semibold mb-3">
            {userData.title}
          </p>
        )}

        {userData.tagline && (
          <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-3">
            {userData.tagline}
          </p>
        )}

        <div className="flex flex-wrap gap-4 justify-center">
          {fields.includes("email") && userData.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="email" />
              <span>{userData.email}</span>
            </div>
          )}

          {fields.includes("phone") && userData.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="phone" />
              <span>{userData.phone}</span>
            </div>
          )}

          {fields.includes("linkedin") && userData.linkedin && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="linkedin" />
              <span>{userData.linkedin}</span>
            </div>
          )}

          {fields.includes("github") && userData.github && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="github" />
              <span>{userData.github}</span>
            </div>
          )}

          {fields.includes("portfolio") && userData.portfolio && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="portfolio" />
              <span>{userData.portfolio}</span>
            </div>
          )}

          {fields.includes("address") && userData.address && (
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ContactIcon type="address" />
              <span>{userData.address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ParagraphSection = ({ section, content }) => {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
        {safeRender(content, section.placeholder)}
      </p>
    </div>
  );
};

const TimelineSection = ({ section, items }) => {
  const bulletStyles = {
    "filled-circle": "•",
    "dash": "–",
    "arrow": "→"
  };

  const bullet = bulletStyles[section.format?.bulletStyle] || "•";

  return (
    <div className="space-y-4">
      {(items || [section.placeholder]).map((item, idx) => (
        <div key={idx} className="border-l-2 border-emerald-500 pl-4">
          <div className="font-semibold text-gray-900 dark:text-white mb-1">
            {typeof item === "string" ? item.split("\n")[0] : item.title || "Position Title"}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {typeof item === "string" ? item.split("\n")[1] : item.subtitle || "Company | Date Range"}
          </div>
          {typeof item === "string" && item.split("\n").length > 2 && (
            <ul className="space-y-1 text-gray-700 dark:text-gray-300">
              {item.split("\n").slice(2).map((line, i) => (
                line.trim() && <li key={i} className="ml-4">{bullet} {line.replace(/^[•\-–→]\s*/, "")}</li>
              ))}
            </ul>
          )}
          {typeof item === "object" && item.bullets && (
            <ul className="space-y-1 text-gray-700 dark:text-gray-300">
              {item.bullets.map((b, i) => (
                <li key={i} className="ml-4">{bullet} {b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

const GridSection = ({ section, items }) => {
  const columns = section.format?.columns || 3;

  return (
    <div className={cn("grid gap-3", `grid-cols-${columns}`)}>
      {(items || section.placeholder.split(",")).map((item, idx) => (
        <div
          key={idx}
          className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg text-center text-sm font-medium text-gray-900 dark:text-white"
        >
          {safeRender(item)}
        </div>
      ))}
    </div>
  );
};

const CategorizedSection = ({ section, data }) => {
  const categories = section.format?.categories || [];
  const parsedData = typeof data === "string"
    ? data.split("\n").map(line => {
      const [cat, skills] = line.split(":");
      return { category: cat?.trim(), skills: skills?.trim() };
    })
    : data;

  return (
    <div className="space-y-3">
      {(Array.isArray(parsedData) ? parsedData : categories.map(c => ({ category: c, skills: "" }))).map((item, idx) => (
        <div key={idx}>
          <h4 className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 mb-1">
            {item.category}
          </h4>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            {safeRender(item.skills, section.placeholder)}
          </p>
        </div>
      ))}
    </div>
  );
};

const TagsSection = ({ section, tags }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {(tags || section.placeholder.split(",")).map((tag, idx) => (
        <span
          key={idx}
          className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-full"
        >
          {safeRender(tag)}
        </span>
      ))}
    </div>
  );
};

const ListSection = ({ section, items }) => {
  return (
    <ul className="space-y-2">
      {(items || [section.placeholder]).map((item, idx) => (
        <li key={idx} className="text-gray-700 dark:text-gray-300">
          • {safeRender(item)}
        </li>
      ))}
    </ul>
  );
};

const SectionRenderer = ({ section, userData }) => {
  const content = userData[section.id];

  const renderers = {
    paragraph: () => <ParagraphSection section={section} content={content} />,
    timeline: () => <TimelineSection section={section} items={content} />,
    grid: () => <GridSection section={section} items={content} />,
    categorized: () => <CategorizedSection section={section} data={content} />,
    tags: () => <TagsSection section={section} tags={content} />,
    list: () => <ListSection section={section} items={content} />,
    "simple-list": () => <ListSection section={section} items={content} />,
    showcase: () => <TimelineSection section={section} items={content} />,
    gallery: () => <GridSection section={section} items={content} />,
    text: () => <p className="text-gray-700 dark:text-gray-300">{safeRender(content, section.placeholder)}</p>,
    formal: () => <ParagraphSection section={section} content={content} />
  };

  const Renderer = renderers[section.type] || renderers.paragraph;

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 border-b-2 border-emerald-500 pb-1">
        {section.title}
      </h2>
      <Renderer />
    </div>
  );
};



const DynamicTemplateRenderer = ({ template, userData }) => {
  const { structure, formatting } = template;

  const styles = useMemo(() => ({
    fontSize: formatting?.fontSize || { body: "1rem", heading: "1.5rem" },
    spacing: formatting?.spacing || { lineHeight: "1.5" },
    colors: formatting?.colors || { text: "#000000" }
  }), [formatting]);

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-4xl mx-auto"
      style={{
        color: styles.colors.text,
        lineHeight: styles.spacing.lineHeight
      }}
    >
      <TemplateHeader template={template} userData={userData} />

      <div className="space-y-6">
        {structure.sections
          .filter(section => !section.optional || userData[section.id])
          .map((section, idx) => (
            <SectionRenderer
              key={`${section.id}-${idx}`}
              section={section}
              userData={userData}
            />
          ))}
      </div>
    </div>
  );
};

import { mergeResumeData } from "../../lib/utils/resumeUtils";

interface UserData {
  [key: string]: unknown;
  meta?: {
    aiAnalysisResult?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface TemplateRendererProps {
  template: { id: string; structure: unknown; formatting?: unknown };
  userData?: UserData;
  aiAnalysisResult?: Record<string, unknown> | null;
}

export default function TemplateRenderer({ template, userData = {}, aiAnalysisResult = null }: TemplateRendererProps) {
  // MERGE: Ensure we have the full data set (Original + AI Suggestions)
  const optimization = aiAnalysisResult || userData.meta?.aiAnalysisResult || {};
  const mergedData = mergeResumeData(userData, { optimization });

  // Fallback to userData if merge failed (e.g., missing basics)
  const finalData = mergedData || userData;

  // Debug: Log data structure for template
  console.log('[TemplateRenderer] Template:', template.id);
  console.log('[TemplateRenderer] finalData has skills:', (finalData as any)?.skills?.length || 0);
  console.log('[TemplateRenderer] finalData.basics:', !!(finalData as any)?.basics);

  // Use registry to get the correct component by template ID
  const templateId = template.id as TemplateId;
  const TemplateComponent = getTemplate(templateId);

  // Check if this is a known template from the registry
  // If so, use the proper component with the resume prop structure
  if (['modern-professional', 'classic-traditional', 'technical-engineer'].includes(template.id)) {
    // Registry templates expect { resume } prop
    return <TemplateComponent resume={finalData} />;
  }

  // Fallback to generic dynamic renderer for custom/unknown templates
  return <DynamicTemplateRenderer template={template} userData={finalData} />;
}





