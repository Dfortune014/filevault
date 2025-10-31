import React from "react";
import * as Slot from "@radix-ui/react-slot";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive" | "hero";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = "default", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
    const variants: Record<string, string> = {
      default: "bg-blue-600 text-white hover:bg-blue-700",
      outline: "border border-gray-300 text-gray-900 bg-white hover:bg-gray-50",
      ghost: "bg-transparent text-gray-900 hover:bg-gray-100",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      hero: "bg-blue-600 text-white hover:bg-blue-700",
    };
    const sizes: Record<string, string> = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };
    const classes = [base, variants[variant], sizes[size], className]
      .filter(Boolean)
      .join(" ");
    return (
      <Comp ref={ref} className={classes} {...props}>
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export default Button;


