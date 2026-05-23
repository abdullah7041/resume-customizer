import { Children, isValidElement, type ReactNode } from "react";
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./shadcn/tooltip";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  children: ReactNode;
  content?: ReactNode;
  position?: TooltipPosition;
}

export default function Tooltip({
  children,
  content,
  position = "top",
}: TooltipProps) {
  if (!content) {
    return <>{children}</>;
  }

  const trigger =
    Children.count(children) === 1 && isValidElement(children) ? (
      children
    ) : (
      <span className="inline-flex">{children}</span>
    );

  return (
    <TooltipProvider delayDuration={0}>
      <ShadcnTooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={position} sideOffset={8}>
          {content}
        </TooltipContent>
      </ShadcnTooltip>
    </TooltipProvider>
  );
}




