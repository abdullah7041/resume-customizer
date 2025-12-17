import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils/cn.ts";

export default function Tabs({ tabs, activeValue, onTabChange }) {
  const itemsRef = useRef([]);
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to show/hide scroll indicators
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs]);

  const scrollBy = (direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 150;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

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
    <div className="relative flex items-center w-full max-w-full">
      {/* Left scroll button - visible on mobile when can scroll */}
      <button
        type="button"
        onClick={() => scrollBy('left')}
        className={cn(
          "sm:hidden flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 mr-1 transition-all duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll tabs left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollContainerRef}
        role="tablist"
        aria-label="Resume workflow navigation"
        className="relative flex flex-1 min-w-0 items-center gap-1 sm:gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar rounded-pill border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_8%)] p-1 sm:p-1.5 shadow-soft backdrop-blur-glass sm:flex-wrap"
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
                "group relative flex min-w-max snap-start items-center justify-center gap-1 sm:gap-2 overflow-hidden rounded-[calc(var(--radius-pill)*0.7)] px-2.5 sm:px-5 py-2 sm:py-3 text-[11px] sm:text-sm font-semibold tracking-wide transition-all duration-snappy ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent whitespace-nowrap",
                isActive
                  ? "bg-[image:var(--gradient-muted-value)] text-white shadow-lift"
                  : "text-ink-muted hover:text-ink hover:bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)]"
              )}
            >
              {Icon && <Icon className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", isActive ? "text-white" : "text-ink-soft/80")} aria-hidden="true" />}
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
                  className="pointer-events-none absolute inset-x-2 sm:inset-x-4 bottom-1 h-0.5 rounded-full bg-white/70"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right scroll button - visible on mobile when can scroll */}
      <button
        type="button"
        onClick={() => scrollBy('right')}
        className={cn(
          "sm:hidden flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 ml-1 transition-all duration-200",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll tabs right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}




