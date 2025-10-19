// src/hooks/useKeywordAnalysis.js
// React hook for real-time keyword analysis with debouncing

import { useState, useEffect, useRef } from "react";
import { calculateTFIDF, analyzeKeywordDensity, suggestKeywordChanges } from "../services/keywordAnalyzer.js";

const DEBOUNCE_DELAY = 500; // 500ms debounce

/**
 * Hook for real-time keyword analysis
 * @param {string} resumeText - Resume text
 * @param {string} jobDescription - Job description text
 * @param {Object} options - Configuration options
 * @returns {Object} Analysis results and loading state
 */
export const useKeywordAnalysis = (resumeText, jobDescription, options = {}) => {
  const {
    enabled = true,
    debounceMs = DEBOUNCE_DELAY,
    topKeywords = 10
  } = options;
  
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const timeoutRef = useRef(null);
  const previousInputRef = useRef({ resumeText: "", jobDescription: "" });
  
  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      setIsAnalyzing(false);
      return;
    }
    
    // Skip if inputs haven't changed
    if (
      previousInputRef.current.resumeText === resumeText &&
      previousInputRef.current.jobDescription === jobDescription
    ) {
      return;
    }
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set analyzing state immediately
    setIsAnalyzing(true);
    
    // Debounced analysis
    timeoutRef.current = setTimeout(() => {
      try {
        const resumeDensity = analyzeKeywordDensity(resumeText, topKeywords);
        const jobDensity = analyzeKeywordDensity(jobDescription, topKeywords);
        const tfidf = calculateTFIDF(resumeText, jobDescription);
        const suggestions = suggestKeywordChanges(resumeText, jobDescription);
        
        setAnalysis({
          resume: resumeDensity,
          job: jobDensity,
          tfidf,
          suggestions,
          timestamp: Date.now()
        });
        
        previousInputRef.current = { resumeText, jobDescription };
      } catch (error) {
        console.error("Keyword analysis error:", error);
        setAnalysis(null);
      } finally {
        setIsAnalyzing(false);
      }
    }, debounceMs);
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resumeText, jobDescription, enabled, debounceMs, topKeywords]);
  
  return {
    analysis,
    isAnalyzing,
    hasData: Boolean(analysis)
  };
};

export default useKeywordAnalysis;
