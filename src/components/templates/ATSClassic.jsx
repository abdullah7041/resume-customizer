// 🛡️ The "Boring" Template - Guaranteed to Parse
export const ATSClassic = ({ data }) => {
    if (!data) return null;

    return (
        // ID is crucial for the print function to find this
        <div
            id="ats-resume-print-target"
            className="bg-white text-black font-serif p-8 max-w-[210mm] mx-auto min-h-[297mm]"
            style={{ fontFamily: '"Times New Roman", Times, serif' }} // ATS standard font
        >
            {/* 1. HEADER (Centered, Simple) */}
            <header className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">
                    {data.header?.name || "Your Name"}
                </h1>
                <div className="flex flex-wrap justify-center gap-3 text-sm">
                    {data.header?.email && <span>{data.header.email}</span>}
                    {data.header?.phone && <span>• {data.header.phone}</span>}
                    {data.header?.location && <span>• {data.header.location}</span>}
                    {data.header?.linkedin && <span>• {data.header.linkedin}</span>}
                </div>
                {data.header?.title && (
                    <h2 className="text-xl font-bold mt-3">{data.header.title}</h2>
                )}
            </header>

            {/* 2. SUMMARY */}
            {data.summary && (
                <section className="mb-6">
                    <h3 className="font-bold uppercase border-b border-black mb-2 text-sm">Professional Summary</h3>
                    <p className="text-sm leading-relaxed">{data.summary}</p>
                </section>
            )}

            {/* 3. EXPERIENCE (The Critical Part) */}
            {data.experience && data.experience.length > 0 && (
                <section className="mb-6">
                    <h3 className="font-bold uppercase border-b border-black mb-4 text-sm">Experience</h3>
                    <div className="space-y-5">
                        {data.experience.map((job, index) => (
                            <div key={index} className="break-inside-avoid">
                                <div className="flex justify-between items-baseline">
                                    <h4 className="font-bold text-md">{job.company}</h4>
                                    <span className="text-sm italic">{job.date || "Dates"}</span>
                                </div>
                                <div className="italic text-sm mb-1">{job.position}</div>
                                <ul className="list-disc ml-5 space-y-1 text-sm">
                                    {/* Handle both String and Array descriptions */}
                                    {Array.isArray(job.description) ? (
                                        job.description.map((bullet, i) => (
                                            <li key={i} className="pl-1">{bullet}</li>
                                        ))
                                    ) : (
                                        // Split by newline if it's a long string
                                        job.description.split('\n').map((line, i) => line && <li key={i}>{line}</li>)
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 4. SKILLS */}
            {data.skills && data.skills.length > 0 && (
                <section className="mb-6 break-inside-avoid">
                    <h3 className="font-bold uppercase border-b border-black mb-2 text-sm">Technical Skills</h3>
                    <div className="text-sm leading-relaxed">
                        {data.skills.join(" • ")}
                    </div>
                </section>
            )}

            {/* 5. EDUCATION */}
            {data.education && data.education.length > 0 && (
                <section className="mb-6 break-inside-avoid">
                    <h3 className="font-bold uppercase border-b border-black mb-2 text-sm">Education</h3>
                    {data.education.map((edu, index) => (
                        <div key={index} className="mb-2">
                            <div className="flex justify-between font-bold text-sm">
                                <span>{edu.institution}</span>
                                <span>{edu.date}</span>
                            </div>
                            <div className="text-sm">{edu.degree}</div>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
};