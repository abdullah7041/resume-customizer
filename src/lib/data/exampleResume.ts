// Example resume data for Vision 2030 demo mode
// Contains keywords that align well with Vision 2030 sectors

/**
 * Pre-loaded example resume text containing Vision 2030 keywords
 * This text is designed to produce ~82% alignment score
 * across Technology, Finance, Manufacturing, and Mega Projects sectors
 */
export const EXAMPLE_RESUME_TEXT = `
Ahmed Al-Rashid
Senior Software Engineer | Digital Transformation Specialist
Riyadh, Saudi Arabia | ahmed.alrashid@email.com

PROFESSIONAL SUMMARY
Innovative technology leader with 8+ years of experience driving digital transformation initiatives across Saudi Arabia's key growth sectors. Expert in artificial intelligence, machine learning, and cloud computing with proven track record of delivering impactful solutions aligned with Vision 2030 objectives.

SKILLS
• Artificial Intelligence & Machine Learning
• Cloud Computing (AWS, Azure, Google Cloud)
• Data Science & Analytics (Python, SQL, Big Data)
• Cybersecurity & Information Security
• Blockchain & Smart Contracts
• Software Development (JavaScript, React, Node.js)
• Digital Transformation & Innovation
• Project Management (PMP, Agile, Scrum)
• Fintech & Digital Payments
• IoT & Smart Systems
• Sustainability & ESG Compliance

WORK EXPERIENCE

Senior Software Engineer | Saudi Aramco Digital
Dhahran, Saudi Arabia | 2020 - Present
• Led digital transformation initiatives using AI and cloud technologies
• Developed machine learning models for predictive maintenance, reducing downtime by 35%
• Implemented cybersecurity protocols for critical infrastructure protection
• Managed cross-functional teams using Agile methodologies
• Drove automation efforts aligned with Industry 4.0 standards

Data Scientist | NEOM Tech Division
NEOM, Saudi Arabia | 2018 - 2020
• Developed machine learning models for smart city applications
• Built data analytics pipelines using Hadoop and Spark
• Created computer vision solutions for autonomous systems
• Collaborated on renewable energy optimization projects
• Implemented IoT solutions for sustainable urban development

Software Engineer | STC Pay (Fintech)
Riyadh, Saudi Arabia | 2016 - 2018
• Built digital payment solutions using blockchain technology
• Developed mobile banking applications with enhanced security
• Implemented KYC/AML compliance systems
• Created APIs for financial services integration

EDUCATION

Master of Science in Computer Science
King Abdullah University of Science and Technology (KAUST) | 2016
Focus: Artificial Intelligence & Data Science

Bachelor of Software Engineering
King Saud University | 2014
First Class Honours

CERTIFICATIONS
• AWS Solutions Architect Professional
• Google Cloud Professional Data Engineer
• PMP (Project Management Professional)
• Certified Ethical Hacker (CEH)
• Six Sigma Green Belt

LANGUAGES
• Arabic (Native)
• English (Fluent)
`;

/**
 * Expected demo alignment results
 * These values match what the analyzer produces for EXAMPLE_RESUME_TEXT
 */
export const DEMO_ALIGNMENT_INFO = {
    expectedScore: 82, // Approximate score the example resume should produce
    isDemo: true,
};
