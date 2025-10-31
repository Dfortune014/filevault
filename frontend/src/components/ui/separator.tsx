import React from "react";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export const Separator: React.FC<SeparatorProps> = ({ className, orientation = "horizontal", ...props }) => {
  const base = orientation === "vertical" ? "w-px h-full" : "h-px w-full";
  const classes = [base, "bg-gray-200", className].filter(Boolean).join(" ");
  return <div role="separator" aria-orientation={orientation} className={classes} {...props} />;
};

export default Separator;


