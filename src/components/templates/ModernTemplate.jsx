import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';

// Helper to safely render a value (handles strings, objects, arrays)
const safeRender = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
};

const ModernTemplate = ({ userData }) => {
    const data = userData || {};

    // Safely extract header info (handles both flat and nested structures)
    const name = safeRender(data.header?.name || data.name);
    const title = safeRender(data.header?.title || data.title);
    const email = safeRender(data.header?.email || data.email);
    const phone = safeRender(data.header?.phone || data.phone);
    const address = safeRender(data.header?.location || data.address);
    const linkedin = safeRender(data.header?.linkedin || data.linkedin);
    const github = safeRender(data.github);
    const portfolio = safeRender(data.portfolio);
    const summary = safeRender(data.summary);

    // Safely get skills as array of strings
    const getSkills = () => {
        const skills = data.skills;
        if (!skills) return [];
        if (Array.isArray(skills)) {
            return skills.map(s => safeRender(s)).filter(Boolean);
        }
        if (typeof skills === "string") {
            return skills.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
        }
        return [];
    };
    const skills = getSkills();

    // Helper to render experience item (handles both object and string)
    const renderExperience = (job, index) => {
        if (typeof job === "string") {
            return (
                <li key={index} className="text-sm text-gray-700 leading-relaxed pl-1">
                    {job}
                </li>
            );
        }
        const descriptions = Array.isArray(job.description)
            ? job.description.map(d => safeRender(d))
            : typeof job.description === "string"
                ? job.description.split("\n").filter(Boolean)
                : [];

        return (
            <div key={index} className="break-inside-avoid">
                <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-gray-800">{safeRender(job.title || job.position)}</h3>
                    <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                        {safeRender(job.date)}
                    </span>
                </div>
                <div className="text-emerald-700 font-medium text-sm mb-2">
                    {safeRender(job.company)}
                </div>
                {descriptions.length > 0 && (
                    <ul className="list-disc list-outside ml-4 space-y-1">
                        {descriptions.map((desc, i) => (
                            <li key={i} className="text-sm text-gray-700 leading-relaxed pl-1">
                                {desc}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    // Helper to render education item (handles both object and string)
    const renderEducation = (edu, index) => {
        if (typeof edu === "string") {
            return (
                <div key={index} className="text-sm text-gray-700">
                    {edu}
                </div>
            );
        }
        return (
            <div key={index}>
                <h3 className="font-bold text-gray-800 text-sm">
                    {safeRender(edu.degree)}
                </h3>
                <div className="text-emerald-700 text-xs font-medium mb-1">
                    {safeRender(edu.school || edu.institution)}
                </div>
                <div className="text-gray-500 text-xs">
                    {safeRender(edu.year || edu.date)}
                </div>
            </div>
        );
    };

    // Helper to render project item (handles both object and string)
    const renderProject = (project, index) => {
        if (typeof project === "string") {
            return (
                <div key={index} className="break-inside-avoid">
                    <p className="text-sm text-gray-700 leading-relaxed">{project}</p>
                </div>
            );
        }
        return (
            <div key={index} className="break-inside-avoid">
                <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-gray-800">{safeRender(project.name)}</h3>
                    {project.link && typeof project.link === "string" && (
                        <a href={project.link} className="text-xs text-emerald-600 hover:underline">
                            View Project
                        </a>
                    )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                    {safeRender(project.description)}
                </p>
            </div>
        );
    };

    const experience = Array.isArray(data.experience) ? data.experience : [];
    const education = Array.isArray(data.education) ? data.education : [];
    const projects = Array.isArray(data.projects) ? data.projects : [];

    return (
        <div className="w-full h-full bg-white text-gray-800 font-sans selection:bg-emerald-100 selection:text-emerald-900 p-8" id="resume-preview">
            {/* Header */}
            <header className="border-b-4 border-emerald-500 pb-6 mb-6">
                <h1 className="text-4xl font-bold text-gray-900 uppercase tracking-tight mb-2">
                    {name || "Your Name"}
                </h1>
                <p className="text-xl text-emerald-600 font-medium mb-4">
                    {title || "Professional Title"}
                </p>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-emerald-500" />
                        <span>{email || "email@example.com"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-emerald-500" />
                        <span>{phone || "(123) 456-7890"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                        <span>{address || "City, Country"}</span>
                    </div>
                    {linkedin && (
                        <div className="flex items-center gap-1.5">
                            <Linkedin className="w-4 h-4 text-emerald-500" />
                            <span>{linkedin}</span>
                        </div>
                    )}
                    {github && (
                        <div className="flex items-center gap-1.5">
                            <Github className="w-4 h-4 text-emerald-500" />
                            <span>{github}</span>
                        </div>
                    )}
                    {portfolio && (
                        <div className="flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-emerald-500" />
                            <span>{portfolio}</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Main Column */}
                <div className="col-span-8 space-y-6">
                    {/* Summary */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-3">
                            Professional Summary
                        </h2>
                        <p className="text-sm leading-relaxed text-gray-700">
                            {summary || "Add your professional summary here highlighting your key achievements and expertise."}
                        </p>
                    </section>

                    {/* Experience */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-4">
                            Experience
                        </h2>
                        <div className="space-y-5">
                            {experience.length > 0 ? (
                                experience.map(renderExperience)
                            ) : (
                                <div className="break-inside-avoid">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold text-gray-800">Job Title</h3>
                                        <span className="text-sm text-gray-500 font-medium whitespace-nowrap">2020 - Present</span>
                                    </div>
                                    <div className="text-emerald-700 font-medium text-sm mb-2">Company Name</div>
                                    <ul className="list-disc list-outside ml-4 space-y-1">
                                        <li className="text-sm text-gray-700 leading-relaxed pl-1">Achievement or responsibility with quantifiable results.</li>
                                        <li className="text-sm text-gray-700 leading-relaxed pl-1">Another achievement demonstrating impact.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Projects */}
                    {projects.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-4">
                                Projects
                            </h2>
                            <div className="space-y-4">
                                {projects.map(renderProject)}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar Column */}
                <div className="col-span-4 space-y-6">
                    {/* Skills */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-3">
                            Skills
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {skills.length > 0 ? (
                                skills.map((skill, i) => (
                                    <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                                        {skill}
                                    </span>
                                ))
                            ) : (
                                <>
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">Skill 1</span>
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">Skill 2</span>
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">Skill 3</span>
                                </>
                            )}
                        </div>
                    </section>

                    {/* Education */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-3">
                            Education
                        </h2>
                        <div className="space-y-4">
                            {education.length > 0 ? (
                                education.map(renderEducation)
                            ) : (
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Degree Name</h3>
                                    <div className="text-emerald-700 text-xs font-medium mb-1">University Name</div>
                                    <div className="text-gray-500 text-xs">2020</div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: A4 portrait;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
          }
        }
      `}</style>
        </div>
    );
};

export default ModernTemplate;
