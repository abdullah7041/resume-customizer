import { beforeEach, expect, it, vi } from 'vitest';
import { jobRuntime } from '../job-runtime.js';
beforeEach(()=>{
 vi.stubEnv('URL','https://watheqai.app');vi.stubEnv('SITE_NAME','resume-optimizing');vi.stubEnv('CONTEXT','');vi.stubEnv('DEPLOY_URL','');vi.stubEnv('DEPLOY_PRIME_URL','');
});
it.each(['https://watheqai.app','https://resume-optimizing.netlify.app'])('recognizes the production site at %s without build-only context variables',origin=>{
 expect(jobRuntime(`${origin}/.netlify/functions/cron-job-alerts`)).toEqual({origin,scheduled:true});
});
it.each(['https://deploy-preview-150--resume-optimizing.netlify.app','https://unique-deploy--resume-optimizing.netlify.app'])('keeps %s on its own deployment without reporting a schedule',origin=>{
 expect(jobRuntime(`${origin}/.netlify/functions/job-sources-api`)).toEqual({origin,scheduled:false});
});
it.each(['https://other.netlify.app','https://resume-optimizing.netlify.app.attacker.test','https://deploy--other.netlify.app','http://watheqai.app','https://user:password@watheqai.app','https://watheqai.app:444','garbage'])('rejects untrusted runtime URL %s without canonical fallback',rawUrl=>{
 expect(jobRuntime(rawUrl)).toEqual({origin:null,scheduled:false});
});
