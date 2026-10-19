"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const badgeVariants = (props: { variant?: BadgeProps["variant"] }) => {
  const { variant = "default" } = props;
  return cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    variant === "default"
      && "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    variant === "secondary"
      && "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80",
    variant === "destructive"
      && "border-destructive text-destructive-foreground hover:bg-destructive/80",
    variant === "outline"
      && "border-input bg-background hover:bg-accent hover:text-accent-foreground",
  );
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = "Badge";

export { Badge, badgeVariants };
