import React from "react";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const base = "rounded-lg border border-gray-200 bg-white shadow-sm";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const base = "p-4 border-b border-gray-200";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  const base = "text-lg font-semibold";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <h3 className={classes} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => {
  const base = "text-sm text-gray-500";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <p className={classes} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const base = "p-4";
  const classes = [base, className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;


