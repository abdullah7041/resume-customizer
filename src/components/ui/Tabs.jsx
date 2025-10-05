import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

const tabPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none"><path d="M0 80h160" stroke="white" stroke-opacity="0.05" stroke-width="6"/><path d="M80 0v160" stroke="white" stroke-opacity="0.05" stroke-width="6"/><path d="M0 0l80 80L0 160" stroke="white" stroke-opacity="0.04" stroke-width="5"/><path d="M160 0l-80 80 80 80" stroke="white" stroke-opacity="0.04" stroke-width="5"/><circle cx="80" cy="80" r="22" stroke="white" stroke-opacity="0.04" stroke-width="6"/></svg>'
);

export default function Tabs({ tabs, activeValue, onTabChange }) {
  const itemsRef = useRef([]);

  useEffect(() => {
    if (!itemsRef.current) return;
    const activeIndex = tabs.findIndex((tab) => tab.value === activeValue);
    if (activeIndex >= 0) {
      itemsRef.current.forEach((item, idx) => {
        if (!item) return;
        item.setAttribute("aria-selected", idx === activeIndex ? "true" : "false");
      });
    }
  }, [activeValue, tabs]);

  const focusTab = (index) => {
    const el = itemsRef.current[index];
    if (el) {
      el.focus();
      onTabChange?.(tabs[index].value);
    }
  };

  const handleKeyDown = (event, index) => {
    if (!tabs.length) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        focusTab((index + 1) % tabs.length);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        focusTab((index - 1 + tabs.length) % tabs.length);
        break;
      }
      case "Home": {
        event.preventDefault();
        focusTab(0);
        break;
      }
      case "End": {
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Resume workflow navigation"
      className="relative flex flex-wrap items-center justify-between gap-2 rounded-[calc(var(--radius-card)*1.2)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-1.5 text-[color:var(--ink)] backdrop-blur-sm"
    >
      {tabs.map(({ value, label, icon: Icon }, index) => {
        const isActive = value === activeValue;
        return (
          <button
            key={value}
            ref={(el) => {
              itemsRef.current[index] = el;
            }}
            role="tab"
            id={`tab-${value}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange?.(value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "group tab-pattern-hover relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-[calc(var(--radius-card)*0.85)] px-4 py-3 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]",
              isActive
                ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-[var(--shadow-soft)]"
                : "text-[color:var(--ink-muted)] hover:bg-[color:color-mix(in_oklab,var(--surface),transparent_5%)] hover:text-[color:var(--ink)]"
            )}
            style={{ "--tab-pattern": `url("data:image/svg+xml,${tabPattern}")` }}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            <span className="tracking-wide">{label}</span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-6 bottom-1 h-1 rounded-full bg-[color:var(--secondary)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
