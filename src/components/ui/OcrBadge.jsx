import { Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Visual indicator showing when OCR was used to extract resume text
 */
export default function OcrBadge({ className }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
        "bg-gradient-to-r from-purple-500/20 to-blue-500/20",
        "border border-purple-400/30",
        "backdrop-blur-sm",
        "text-xs font-medium text-purple-200",
        "shadow-lg shadow-purple-500/10",
        className
      )}
      title="Text extracted using AI OCR technology"
    >
      <Sparkles className="h-3 w-3" />
      <span>OCR Extracted</span>
    </div>
  );
}
