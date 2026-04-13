"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FaucetSectionProps {
  number: number;
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FaucetSection({
  number,
  title,
  defaultOpen = true,
  className,
  children,
}: FaucetSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary font-inter text-sm font-bold text-primary-foreground">
            {number}
          </span>
          <span className="font-mulish text-xl font-bold uppercase tracking-wide text-text-heading sm:text-[26px] sm:leading-10">
            {title}
          </span>
        </div>
        <span
          aria-hidden="true"
          className="material-icons text-[24px]! text-text-muted transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          expand_more
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
