// 🛡️ ATS-Classic Template - Matches "Michael Harris" Reference
// Layout: Single Column, Sans-Serif (Arial), Bold Headers, Uppercase Section Titles
// PDF Compatible: Uses inline hex styles.

export const ATSClassic = ({ data }) => {
  if (!data) return null;

  const safeRender = (value, fallback = "") => {
    if (!value) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  const styles = {
    container: {
      backgroundColor: '#ffffff',
      color: '#000000',
      padding: '40px 50px',
      maxWidth: '210mm',
      margin: '0 auto',
      minHeight: '297mm',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10.5pt',
      lineHeight: '1.4',
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
    },
    name: {
      fontSize: '24pt',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      marginBottom: '8px',
      letterSpacing: '0.5px',
    },
    title: {
      fontSize: '11pt',
      fontWeight: 'bold',
      marginBottom: '6px',
    },
    contact: {
      fontSize: '10pt',
      color: '#000000',
    },
    section: {
      marginTop: '20px',
      marginBottom: '10px',
    },
    sectionHeader: {
      fontSize: '12pt',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      borderBottom: '1px solid #000000',
      paddingBottom: '2px',
      marginBottom: '12px',
      letterSpacing: '0.5px',
    },
    jobBlock: {
      marginBottom: '10px',
    },
    jobHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: '2px',
    },
    jobTitle: {
      fontWeight: 'bold',
      fontSize: '10.5pt',
    },
    jobCompany: {
      fontSize: '10.5pt',
    },
    jobDate: {
      fontWeight: 'bold',
      fontSize: '10.5pt',
    },
    bullets: {
      marginTop: '4px',
      paddingLeft: '18px',
      listStyleType: 'disc',
    },
    bulletItem: {
      marginBottom: '3px',
    },
  };

  // Header Data
  const name = safeRender(data.header?.name || data.name, "MICHAEL HARRIS");
  const title = safeRender(data.header?.title || data.title, "");
  const email = safeRender(data.header?.email || data.email, "");
  const phone = safeRender(data.header?.phone || data.phone, "");
  const location = safeRender(data.header?.location || data.address, "");
  const linkedin = safeRender(data.header?.linkedin || data.linkedin, "");

  // Format: "City, Country | email | phone | linkedin"
  const contactParts = [location, email, phone, linkedin].filter(Boolean);
  const contactLine = contactParts.join(" | ");

  // Arrays
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const skills = Array.isArray(data.skills) ? data.skills : (typeof data.skills === 'string' ? data.skills.split(',') : []);

  return (
    <div id="ats-resume-print-target" style={styles.container}>
      <header style={styles.header}>
        <div style={styles.name}>{name}</div>
        {title && <div style={styles.title}>{title}</div>}
        <div style={styles.contact}>{contactLine}</div>
      </header>

      {/* SUMMARY */}
      {data.summary && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>PROFESSIONAL SUMMARY</div>
          <p>{safeRender(data.summary)}</p>
        </div>
      )}

      {/* EXPERIENCE */}
      {experience.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>WORK EXPERIENCE</div>
          {experience.map((job, i) => (
            <div key={i} style={styles.jobBlock}>
              {/* Reference Image: Title line separate from Company? 
                  Image: "Marketing Manager" (Bold)
                  "XYZ Corporation, Sydney, NSW" (Left) ... "January 2022 - Present" (Right)
              */}
              <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{job.title || job.position}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{job.company}{job.location ? `, ${job.location}` : ''}</span>
                <span style={{ fontWeight: 'bold' }}>{job.date || job.year}</span>
              </div>

              {/* Description Bullets */}
              {Array.isArray(job.description) ? (
                <ul style={styles.bullets}>
                  {job.description.map((desc, j) => (
                    <li key={j} style={styles.bulletItem}>{desc}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ marginTop: '4px' }}>{job.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* EDUCATION */}
      {education.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>EDUCATION</div>
          {education.map((edu, i) => (
            <div key={i} style={styles.jobBlock}>
              <div style={{ fontWeight: 'bold' }}>{edu.degree}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{edu.institution || edu.school}{edu.location ? `, ${edu.location}` : ''}</span>
                <span style={{ fontWeight: 'bold' }}>{edu.date || edu.year}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SKILLS */}
      {skills.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>SKILLS</div>
          <ul style={styles.bullets}>
            {skills.map((skill, i) => (
              <li key={i} style={styles.bulletItem}>{safeRender(skill)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};