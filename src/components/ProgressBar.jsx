// src/components/ProgressBar.jsx
import React from "react";
import { useLocation } from "react-router-dom";

const steps = [
  { path: "/resume", label: "Resume" },
  { path: "/job", label: "Job" },
  { path: "/results", label: "Results" },
];

export default function ProgressBar() {
  const location = useLocation();

  // Figure out which step we're on
  const currentIndex = steps.findIndex((step) =>
    location.pathname.startsWith(step.path)
  );

  return (
    <div className="flex items-center justify-center space-x-4 mb-6">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;

        return (
          <div key={step.path} className="flex items-center">
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                ${isActive ? "bg-primary text-white" : ""}
                ${isCompleted ? "bg-secondary text-white" : ""}
                ${!isActive && !isCompleted ? "bg-gray-200 text-gray-600" : ""}
              `}
            >
              {idx + 1}
            </div>
            <span className="ml-2 text-sm font-medium">{step.label}</span>

            {/* Separator */}
            {idx < steps.length - 1 && (
              <div className="w-8 h-0.5 mx-2 bg-gray-300"></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
