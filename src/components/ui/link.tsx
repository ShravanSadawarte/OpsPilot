"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function LinkComponent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link> & { className?: string }) {
  return <Link className={cn(className)} {...props} />;
}

export { LinkComponent as Link };
export default LinkComponent;
