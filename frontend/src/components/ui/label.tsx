import React from "react";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label: React.FC<LabelProps> = ({ className, children, ...props }) => {
  const base = "text-sm font-medium text-gray-700";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <label className={classes} {...props}>
      {children}
    </label>
  );
};

export default Label;


