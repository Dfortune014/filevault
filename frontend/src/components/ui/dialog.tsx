import React from "react";

type RootProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const Dialog: React.FC<RootProps> = ({ open = true, children, ...props }) => {
  if (!open) return null;
  return (
    <div aria-modal="true" role="dialog" {...props}>
      {children}
    </div>
  );
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const base = "fixed inset-0 z-50 flex items-center justify-center bg-black/40";
  const box = "max-w-lg w-full rounded-lg bg-white p-6 shadow-lg";
  return (
    <div className={base}>
      <div className={[box, className].filter(Boolean).join(" ")} {...props}>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={["mb-4", className].filter(Boolean).join(" ")} {...props}>{children}</div>
);

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h3 className={["text-lg font-semibold", className].filter(Boolean).join(" ")} {...props}>{children}</h3>
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => (
  <p className={["text-sm text-gray-600", className].filter(Boolean).join(" ")} {...props}>{children}</p>
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={["mt-6 flex justify-end space-x-2", className].filter(Boolean).join(" ")} {...props}>{children}</div>
);

export default Dialog;


