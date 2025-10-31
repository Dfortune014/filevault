export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | string;
};

export function useToast() {
  function toast(options: ToastOptions) {
    const { title, description, variant } = options;
    const prefix = variant === "destructive" ? "[Error]" : "[Toast]";
    // Minimal placeholder implementation; replace with your preferred toast library
    // eslint-disable-next-line no-console
    console.log(prefix, title || "", description || "");
    if (typeof window !== "undefined" && title) {
      try {
        // Fallback simple UI notification
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        window?.dispatchEvent(
          new CustomEvent("app:toast", { detail: { title, description, variant } })
        );
      } catch {
        // ignore
      }
    }
  }

  return { toast };
}


