import React from "react";

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number; // 0-100
};

export const Progress: React.FC<ProgressProps> = ({ className, value = 0, ...props }) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={["w-full h-3 bg-gray-200 rounded-full overflow-hidden", className].filter(Boolean).join(" ")} {...props}>
      <div
        className="h-full bg-blue-600"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default Progress;


