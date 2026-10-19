"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "@/lib/utils";

export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  defaults: z.infer<TSchema>,
) {
  const form = useForm<any>({ defaultValues: defaults as any });
  return { form, schema };
}

export function validateForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  values: unknown,
): z.infer<TSchema> {
  return schema.parse(values);
}

type FormProps = React.ComponentPropsWithoutRef<"form"> & {
  children?: React.ReactNode;
};
export const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ className, children, ...props }, ref) => (
    <form ref={ref} className={className} {...props}>{children}</form>
  ),
);
Form.displayName = "Form";

type FormFieldProps = {
  name: string;
  children?: React.ReactNode;
  control?: any;
  render?: (props: { field: any; value: any }) => React.ReactNode;
};
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ control, children, name, render, ...props }, ref) => {
    if (render) {
      return (
        <div {...props}>
          {render({ field: { name }, value: "" })}
        </div>
      );
    }
    return <div {...props}>{children}</div>;
  },
);
FormField.displayName = "FormField";

export const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props} />
  ),
);
FormItem.displayName = "FormItem";

export const FormLabel = React.forwardRef<HTMLLabelElement, React.HTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
  ),
);
FormLabel.displayName = "FormLabel";

export const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full", className)} {...props} />
  ),
);
FormControl.displayName = "FormControl";

export const FormMessage = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "destructive" }
>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-xs font-medium", variant === "destructive" && "text-destructive", className)}
      {...props}
    />
  ),
);
FormMessage.displayName = "FormMessage";
