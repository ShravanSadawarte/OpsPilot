"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, ...props }, ref) => (
  <div className="overflow-auto">
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "thead";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "tbody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium", className)} {...props} />
));
TableFooter.displayName = "tfoot";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("[&_td]:border-b [&_tr:last-child]:border-0", className)} {...props} />
));
TableRow.displayName = "tr";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.HTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("font-semibold [&_tr]:border-b", className)} {...props} />
));
TableHead.displayName = "th";

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  colSpan?: number;
  rowSpan?: number;
}
const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, colSpan, rowSpan, ...props }, ref) => (
    <td ref={ref} colSpan={colSpan} rowSpan={rowSpan} className={cn("p-4", className)} {...props} />
  ),
);
TableCell.displayName = "td";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "caption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
