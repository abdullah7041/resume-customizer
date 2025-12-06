import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables BEFORE importing the client
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

async function runDebug() {
    const resumePath = path.join(rootDir, "test_resume.pdf");
    const jobDescription = `
    Software Engineer
    Requirements:
    - Node.js, React, TypeScript
    - Experience with AI integration
    - Strong problem-solving skills
  `;

    if (!fs.existsSync(resumePath)) {
        console.error("Error: test_resume.pdf not found in root.");
        return;
    }

    try {
        // Dynamic import ensures process.env is populated
        const { processResume } = await import("../netlify/lib/gemini-client.js");

        console.log("--- Starting Gemini Debug ---");
        console.log(`Resume: ${resumePath}`);

        const resumeBuffer = fs.readFileSync(resumePath);
        const base64Data = resumeBuffer.toString("base64");

        console.log(`Raw PDF Size: ${resumeBuffer.length} bytes`);

        const startTime = Date.now();
        const result = await processResume(base64Data, jobDescription);
        const duration = Date.now() - startTime;

        console.log("\n--- Analysis Result ---");
        console.log(JSON.stringify(result, null, 2));
        console.log(`\nExecution Time: ${duration}ms`);
        console.log("--- Debug Complete ---");

    } catch (error) {
        console.error("Debug failed:", error);
    }
}

runDebug();
