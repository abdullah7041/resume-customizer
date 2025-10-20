// src/utils/templatePreviews.js
// Generate SVG preview images for resume templates

export function generateTemplatePreview(template) {
  const { preview, name, category } = template;
  const width = 400;
  const height = 500;
  
  // Color schemes
  const colorSchemes = {
    emerald: {
      primary: "#0ea472",
      secondary: "#075951",
      text: "#1f2937",
      accent: "#f4d37d",
      bg: "#ffffff",
      border: "#e5e7eb"
    },
    royal: {
      primary: "#0f766e",
      secondary: "#134e4a",
      text: "#1f2937",
      accent: "#34d399",
      bg: "#f9fafb",
      border: "#d1d5db"
    },
    classic: {
      primary: "#1f2937",
      secondary: "#4b5563",
      text: "#111827",
      accent: "#6b7280",
      bg: "#ffffff",
      border: "#e5e7eb"
    },
    creative: {
      primary: "#ec4899",
      secondary: "#8b5cf6",
      text: "#1f2937",
      accent: "#fbbf24",
      bg: "#fefce8",
      border: "#fde68a"
    },
    executive: {
      primary: "#1e3a8a",
      secondary: "#1e40af",
      text: "#111827",
      accent: "#dc2626",
      bg: "#f8fafc",
      border: "#cbd5e1"
    }
  };
  
  const colors = colorSchemes[preview.colorScheme] || colorSchemes.emerald;
  const isSingleColumn = preview.layout === "single-column";
  
  // Generate SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="${colors.bg}" rx="8"/>
      
      <!-- Border -->
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="${colors.border}" stroke-width="2" rx="8"/>
      
      ${isSingleColumn ? `
        <!-- Single Column Layout -->
        
        <!-- Header Section -->
        <rect x="30" y="30" width="340" height="8" fill="${colors.primary}" rx="4"/>
        <rect x="30" y="45" width="180" height="5" fill="${colors.secondary}" opacity="0.6" rx="2.5"/>
        
        <!-- Contact Info -->
        <rect x="30" y="65" width="80" height="4" fill="${colors.text}" opacity="0.4" rx="2"/>
        <rect x="120" y="65" width="100" height="4" fill="${colors.text}" opacity="0.4" rx="2"/>
        <rect x="230" y="65" width="90" height="4" fill="${colors.text}" opacity="0.4" rx="2"/>
        
        <!-- Section 1: Summary -->
        <rect x="30" y="95" width="120" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        <rect x="30" y="110" width="340" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <rect x="30" y="118" width="320" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <rect x="30" y="126" width="300" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Section 2: Experience -->
        <rect x="30" y="150" width="150" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        
        <!-- Job 1 -->
        <rect x="30" y="170" width="140" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="180" y="170" width="80" height="4" fill="${colors.accent}" opacity="0.5" rx="2"/>
        <circle cx="35" cy="185" r="2" fill="${colors.primary}"/>
        <rect x="45" y="183" width="320" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <circle cx="35" cy="193" r="2" fill="${colors.primary}"/>
        <rect x="45" y="191" width="300" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Job 2 -->
        <rect x="30" y="210" width="140" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="180" y="210" width="80" height="4" fill="${colors.accent}" opacity="0.5" rx="2"/>
        <circle cx="35" cy="225" r="2" fill="${colors.primary}"/>
        <rect x="45" y="223" width="310" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <circle cx="35" cy="233" r="2" fill="${colors.primary}"/>
        <rect x="45" y="231" width="290" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Section 3: Skills -->
        <rect x="30" y="260" width="80" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        <rect x="30" y="280" width="70" height="20" fill="${colors.primary}" opacity="0.15" rx="4"/>
        <rect x="110" y="280" width="90" height="20" fill="${colors.primary}" opacity="0.15" rx="4"/>
        <rect x="210" y="280" width="80" height="20" fill="${colors.primary}" opacity="0.15" rx="4"/>
        <rect x="30" y="308" width="85" height="20" fill="${colors.primary}" opacity="0.15" rx="4"/>
        <rect x="125" y="308" width="75" height="20" fill="${colors.primary}" opacity="0.15" rx="4"/>
        
        <!-- Section 4: Education -->
        <rect x="30" y="350" width="110" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        <rect x="30" y="370" width="160" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="200" y="370" width="60" height="4" fill="${colors.accent}" opacity="0.5" rx="2"/>
        <rect x="30" y="382" width="240" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
      ` : `
        <!-- Two Column Layout -->
        
        <!-- Left Sidebar -->
        <rect x="0" y="0" width="140" height="${height}" fill="${colors.primary}" opacity="0.1" rx="8"/>
        
        <!-- Header -->
        <rect x="20" y="30" width="100" height="8" fill="${colors.primary}" rx="4"/>
        <rect x="20" y="45" width="80" height="5" fill="${colors.secondary}" opacity="0.6" rx="2.5"/>
        
        <!-- Sidebar Contact -->
        <rect x="20" y="80" width="100" height="6" fill="${colors.text}" opacity="0.7" rx="3"/>
        <rect x="20" y="95" width="90" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        <rect x="20" y="103" width="85" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        <rect x="20" y="111" width="95" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        
        <!-- Sidebar Skills -->
        <rect x="20" y="140" width="80" height="6" fill="${colors.text}" opacity="0.7" rx="3"/>
        <circle cx="25" cy="160" r="2" fill="${colors.primary}"/>
        <rect x="32" y="158" width="75" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        <circle cx="25" cy="170" r="2" fill="${colors.primary}"/>
        <rect x="32" y="168" width="80" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        <circle cx="25" cy="180" r="2" fill="${colors.primary}"/>
        <rect x="32" y="178" width="70" height="3" fill="${colors.text}" opacity="0.4" rx="1.5"/>
        
        <!-- Main Content Area -->
        
        <!-- Summary -->
        <rect x="160" y="30" width="120" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        <rect x="160" y="45" width="210" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <rect x="160" y="53" width="200" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <rect x="160" y="61" width="190" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Experience -->
        <rect x="160" y="85" width="150" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        
        <!-- Job 1 -->
        <rect x="160" y="105" width="120" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="160" y="117" width="60" height="4" fill="${colors.accent}" opacity="0.5" rx="2"/>
        <circle cx="165" cy="130" r="2" fill="${colors.primary}"/>
        <rect x="172" y="128" width="190" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <circle cx="165" cy="138" r="2" fill="${colors.primary}"/>
        <rect x="172" y="136" width="180" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Job 2 -->
        <rect x="160" y="158" width="120" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="160" y="170" width="60" height="4" fill="${colors.accent}" opacity="0.5" rx="2"/>
        <circle cx="165" cy="183" r="2" fill="${colors.primary}"/>
        <rect x="172" y="181" width="195" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        <circle cx="165" cy="191" r="2" fill="${colors.primary}"/>
        <rect x="172" y="189" width="175" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
        
        <!-- Education -->
        <rect x="160" y="220" width="110" height="6" fill="${colors.primary}" opacity="0.8" rx="3"/>
        <rect x="160" y="240" width="140" height="5" fill="${colors.secondary}" opacity="0.7" rx="2.5"/>
        <rect x="160" y="252" width="180" height="3" fill="${colors.text}" opacity="0.3" rx="1.5"/>
      `}
      
      <!-- Category Badge -->
      <rect x="${width - 100}" y="${height - 35}" width="80" height="20" fill="${colors.primary}" opacity="0.9" rx="10"/>
      <text x="${width - 60}" y="${height - 20}" font-family="Inter, sans-serif" font-size="10" fill="${colors.bg}" text-anchor="middle" font-weight="600">
        ${category.toUpperCase()}
      </text>
    </svg>
  `;
  
  // Convert to data URL
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

// Generate previews for all templates
export function generateAllPreviews(templates) {
  return templates.map(template => ({
    ...template,
    previewImage: generateTemplatePreview(template)
  }));
}
