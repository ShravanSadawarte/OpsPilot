"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  defaults: z.infer<TSchema>,
) {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  return form;
}

type FormProps = React.ComponentPropsWithoutRef<"form"> & {
  children?: React.ReactNode;
};

const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ className, children, ...props }, ref) => (
    <form ref={ref} className={className} {...props}>
      {children}
    </form>
  ),
);
Form.displayName = "Form";

type FormFieldProps = React.ComponentPropsWithoutRef<"div"> & {
  name: string;
  children: React.ReactNode;
  control?: any;
  render?: (props: { field: any; onChange: any; value: any; onBlur: any }) => React.ReactNode;
};

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ control, children, name, render, ...props }, ref) => {
    if (render) {
      return <div {...props}>{render({ field: { name, onChange: () => {} }, value: "", onBlur: () => {} })}</div>;
    }
    return <div {...props}>{children}</div>;
  },
);
FormField.displayName = "FormField";

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props} />
  ),
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<HTMLLabelElement, React.HTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
  ),
);
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full", className)} {...props} />
  ),
);
FormControl.displayName = "FormControl";

const FormMessage = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { variant?: "destructive" }
>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "text-xs font-medium",
        variant === "destructive" && "text-destructive",
        className,
      )}
      {...props}
    />
  ),
);
FormMessage.displayName = "FormMessage";

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
};
