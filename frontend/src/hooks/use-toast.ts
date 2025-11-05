import { toast as sonnerToast } from "sonner";

export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | string;
};

export function useToast() {
  function toast(options: ToastOptions) {
    const { title, description, variant } = options;
    
    if (variant === "destructive") {
      sonnerToast.error(title || "Error", {
        description: description || "",
        duration: 5000,
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          border: "1px solid hsl(var(--border))",
        },
      });
    } else {
      sonnerToast.success(title || "Success", {
        description: description || "",
        duration: 3000,
      });
    }
  }

  return { toast };
}