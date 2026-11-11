import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{ "--normal-bg": "var(--surface-2)", "--normal-text": "var(--foreground)", "--normal-border": "color-mix(in oklch, var(--electric) 35%, var(--border))", "--border-radius": "1rem" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-surface-2 group-[.toaster]:font-sans group-[.toaster]:font-bold group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
