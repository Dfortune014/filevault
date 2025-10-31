import React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const base = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const classes = [base, className].filter(Boolean).join(" ");
    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = "Input";

export default Input;


