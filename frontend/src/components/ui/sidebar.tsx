import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const cx = (...classes: Array<string | undefined | null | false>) =>
  classes.filter(Boolean).join(" ");

type SidebarContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("Sidebar components must be used within <SidebarProvider>");
  return ctx;
}

const SidebarProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
};

const Sidebar: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => {
  const { open } = useSidebarContext();
  return (
    <aside
      data-collapsed={!open}
      className={cx(
        "border-r bg-card text-card-foreground transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0",
        open ? "w-64" : "w-0 md:w-[4.5rem]",
        className
      )}
    >
      <div className={cx("overflow-hidden", !open && "hidden md:block")}>{children}</div>
    </aside>
  );
};

const SidebarInset: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => {
  return <div className={cx("flex flex-1 min-h-screen flex-col overflow-x-hidden", className)}>{children}</div>;
};

const SidebarHeader: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => {
  const { open } = useSidebarContext();
  
  // Process children to hide spans when collapsed
  const childrenArray = React.Children.toArray(children);
  const processedChildren = childrenArray.map((child: any) => {
    if (child && typeof child === 'object' && child.type === 'div') {
      const divChildren = React.Children.toArray(child.props.children);
      const processedDivChildren = divChildren.map((divChild: any) => {
        if (divChild && typeof divChild === 'object' && divChild.type === 'span') {
          return React.cloneElement(divChild, {
            className: cx(divChild.props.className, !open && 'hidden')
          });
        }
        return divChild;
      });
      return React.cloneElement(child, {
        children: processedDivChildren,
        className: cx(
          child.props.className,
          !open ? "justify-center" : ""
        )
      });
    }
    return child;
  });
  
  return (
    <div className={cx(
      "border-b",
      open ? "p-4" : "p-2",
      className
    )}>
      {processedChildren}
    </div>
  );
};

const SidebarFooter: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={cx("mt-auto border-t p-2", className)}>{children}</div>
);

const SidebarContent: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={cx("p-2", className)}>{children}</div>
);

const SidebarGroup: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={cx("mb-4", className)}>{children}</div>
);

const SidebarGroupLabel: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => {
  const { open } = useSidebarContext();
  return (
    <div className={cx("px-2 py-1 text-xs font-semibold text-muted-foreground", className, !open && "hidden")}>
      {children}
    </div>
  );
};

const SidebarGroupContent: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={cx("", className)}>{children}</div>
);

const SidebarMenu: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <ul className={cx("space-y-1", className)}>{children}</ul>
);

const SidebarMenuItem: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <li className={cx("", className)}>{children}</li>
);

const SidebarMenuButton: React.FC<
  React.PropsWithChildren<{ className?: string; onClick?: () => void }>
> = ({ className, children, onClick }) => {
  const { open } = useSidebarContext();
  
  // Extract icon and text from children - look for any icon component
  const childrenArray = React.Children.toArray(children);
  const icon = childrenArray.find((child: any) => {
    // Check if it's a React component (has type property) and not a span
    return child && typeof child === 'object' && 
           typeof (child as any).type !== 'string' && 
           child.type !== 'span';
  });
  const text = childrenArray.find((child: any) => child?.type === 'span');
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-md px-2 py-2 md:py-1.5 text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center",
        className,
        !open ? "justify-center" : "space-x-2"
      )}
      title={!open && text ? (text as any).props.children : undefined}
    >
      {icon}
      {open && text}
    </button>
  );
};

const SidebarTrigger: React.FC<{ className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  ...props
}) => {
  const { open, setOpen } = useSidebarContext();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cx(
        "inline-flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-md border bg-background text-sm hover:bg-accent transition-colors shrink-0",
        className
      )}
      aria-label="Toggle sidebar"
      {...props}
    >
      {open ? <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />}
    </button>
  );
};

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
};


