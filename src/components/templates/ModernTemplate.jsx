import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';


const ModernTemplate = ({ userData }) => {
    const {
        name,
        title,
        email,
        phone,
        address,
        linkedin,
        github,
        portfolio,
        summary,
        experience,
        education,
        skills,
        projects
    } = userData || {};

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
                            {(experience && experience.length > 0 ? experience : [{
                                company: "Company Name",
                                date: "2020 - Present",
                                title: "Job Title",
                                description: ["Achievement or responsibility with quantifiable results.", "Another achievement demonstrating impact."]
                            }]).map((job, index) => (
                                <div key={index} className="break-inside-avoid">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold text-gray-800">{job.title}</h3>
                                        <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                                            {job.date}
                                        </span>
                                    </div>
                                    <div className="text-emerald-700 font-medium text-sm mb-2">
                                        {job.company}
                                    </div>
                                    <ul className="list-disc list-outside ml-4 space-y-1">
                                        {Array.isArray(job.description) ? (
                                            job.description.map((desc, i) => (
                                                <li key={i} className="text-sm text-gray-700 leading-relaxed pl-1">
                                                    {desc}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-sm text-gray-700 leading-relaxed pl-1">
                                                {job.description}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Projects */}
                    {projects && projects.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200 pb-1 mb-4">
                                Projects
                            </h2>
                            <div className="space-y-4">
                                {projects.map((project, index) => (
                                    <div key={index} className="break-inside-avoid">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-bold text-gray-800">{project.name}</h3>
                                            {project.link && (
                                                <a href={project.link} className="text-xs text-emerald-600 hover:underline">
                                                    View Project
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            {project.description}
                                        </p>
                                    </div>
                                ))}
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
                            {skills ? (typeof skills === 'string' ? (
                                skills.split(',').map((skill, i) => (
                                    <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                                        {skill.trim()}
                                    </span>
                                ))
                            ) : (
                                Array.isArray(skills) ? skills.map((skill, i) => (
                                    <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                                        {skill}
                                    </span>
                                )) : (
                                    <p className="text-sm text-gray-600">{JSON.stringify(skills)}</p>
                                )
                            )) : (
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
                            {(education && education.length > 0 ? (Array.isArray(education) ? education : []) : [{
                                school: "University Name",
                                year: "2020",
                                degree: "Degree Name"
                            }]).map((edu, index) => (
                                <div key={index}>
                                    <h3 className="font-bold text-gray-800 text-sm">{edu.degree}</h3>
                                    <div className="text-emerald-700 text-xs font-medium mb-1">
                                        {edu.school}
                                    </div>
                                    <div className="text-gray-500 text-xs">
                                        {edu.year}
                                    </div>
                                </div>
                            ))}
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
