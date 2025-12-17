import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils/cn.ts";

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
      className="relative flex w-full items-center gap-1.5 sm:gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar rounded-pill border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_8%)] p-1 sm:p-1.5 shadow-soft backdrop-blur-glass sm:flex-wrap"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/5 bg-[image:var(--glass-reflection)] opacity-40"
      />
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
              "group relative flex min-w-max flex-1 snap-start items-center justify-center gap-1.5 sm:gap-2 overflow-hidden rounded-[calc(var(--radius-pill)*0.7)] px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold tracking-wide transition-all duration-snappy ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent whitespace-nowrap",
              isActive
                ? "bg-[image:var(--gradient-muted-value)] text-white shadow-lift"
                : "text-ink-muted hover:text-ink hover:bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)]"
            )}
          >
            {Icon && <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0", isActive ? "text-white" : "text-ink-soft/80")} aria-hidden="true" />}
            <span className="relative z-[1]">{label}</span>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 rounded-[inherit] border border-white/20 opacity-0 transition-opacity duration-snappy ease-snappy",
                isActive ? "opacity-100" : "group-hover:opacity-30"
              )}
            />
            {isActive && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-white/70"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}




