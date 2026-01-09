// src/components/ProgressBar.jsx
// DEPRECATED: This component is not currently used. It was designed for a React Router-based multi-page flow.
// The app uses a single-page layout instead.

export default function ProgressBar() {
  // TODO: Implement this when/if multi-page routing is added
  return null;

  // Original implementation commented out due to missing react-router-dom dependency
  // const location = useLocation();

  // Figure out which step we're on

  // const currentIndex = steps.findIndex((step) =>
  //   location.pathname.startsWith(step.path)
  // );

  // return (
  //   <div className="flex items-center justify-center space-x-4 mb-6">
  //     {steps.map((step, idx) => {
  //       const isActive = idx === currentIndex;
  //       const isCompleted = idx < currentIndex;

  //       return (
  //         <div key={step.path} className="flex items-center">
  //           <div
  //             className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
  //               ${isActive ? "bg-primary-500 text-surface-50" : ""}
  //               ${isCompleted ? "bg-secondary-500 text-surface-50" : ""}
  //               ${!isActive && !isCompleted ? "bg-smoke-50 text-ink-500" : ""}
  //             `}
  //           >
  //             {idx + 1}
  //           </div>
  //           <span className="ml-2 text-sm font-medium">{step.label}</span>

  //           {/* Separator */}
  //           {idx < steps.length - 1 && (
  //             <div className="w-8 h-0.5 mx-2 bg-dune-100"></div>
  //           )}
  //         </div>
  //       );
  //     })}
  //   </div>
  // );
}




