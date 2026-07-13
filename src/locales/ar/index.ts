import common from './common.json';
import credits from './credits.json';
import referrals from './referrals.json';
import nav from './nav.json';
import header from './header.json';
import tabs from './tabs.json';
import workspace from './workspace.json';
import settings from './settings.json';
import trust from './trust.json';
import hrSuperSaud from './hrSuperSaud.json';
import toasts from './toasts.json';
import clarificationModal from './clarificationModal.json';
import landing_hero from './landing/hero.json';
import landing_demo from './landing/demo.json';
import landing_productWalkthrough from './landing/productWalkthrough.json';
import landing_productStory from './landing/productStory.json';
import landing_features from './landing/features.json';
import landing_content from './landing/content.json';
import landing_majlis from './landing/majlis.json';
import upload from './upload.json';
import analysis from './analysis.json';
import optimize from './optimize.json';
import exportNs from './export.json';
import pricing from './pricing.json';
import auth from './auth.json';
import footer from './footer.json';
import consent from './consent.json';
import privacy from './privacy.json';
import refund from './refund.json';
import dataRights from './dataRights.json';
import vision2030 from './vision2030.json';
import templates from './templates.json';
import interview from './interview.json';
import bulkAnalysis from './bulkAnalysis.json';
import coverLetter from './coverLetter.json';
import optimization from './optimization.json';
import sections_resume from './sections/resume.json';
import sections_match from './sections/match.json';
import sections_optimizationResults from './sections/optimizationResults.json';
import sections_optimize from './sections/optimize.json';
import sections_explainability from './sections/explainability.json';
import sections_keywords from './sections/keywords.json';
import sections_templates from './sections/templates.json';
import sections_interview from './sections/interview.json';
import sections_bulk from './sections/bulk.json';
import sections_bulkAnalysis from './sections/bulkAnalysis.json';
import sections_coverLetter from './sections/coverLetter.json';
import sections_truthCheck from './sections/truthCheck.json';
import rateLimit from './rateLimit.json';
import showcase from './showcase.json';
import beta from './beta.json';
import quota from './quota.json';
import resume from './resume.json';
import tour from './tour.json';
import pipeline from './pipeline.json';
import feedback from './feedback.json';

import { deepMerge } from '../utils';

const sources = [
    common,
    credits,
    referrals,
    nav,
    header,
    tabs,
    workspace,
    settings,
    trust,
    hrSuperSaud,
    toasts,
    clarificationModal,
    landing_hero,
    landing_demo,
    landing_productWalkthrough,
    landing_productStory,
    landing_features,
    landing_content,
    landing_majlis,
    upload,
    analysis,
    optimize,
    exportNs,
    pricing,
    auth,
    footer,
    consent,
    privacy,
    refund,
    dataRights,
    vision2030,
    templates,
    interview,
    bulkAnalysis,
    coverLetter,
    optimization,
    sections_resume,
    sections_match,
    sections_optimizationResults,
    sections_optimize,
    sections_explainability,
    sections_keywords,
    sections_templates,
    sections_interview,
    sections_bulk,
    sections_bulkAnalysis,
    sections_coverLetter,
    sections_truthCheck,
    rateLimit,
    showcase,
    beta,
    quota,
    resume,
    tour,
    pipeline,
    feedback,
];

export default deepMerge(sources);
