import React from "react";

type SelectRootProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
};

function isSelectItemElement(node: React.ReactNode): node is React.ReactElement<SelectItemProps> {
  return !!node && typeof node === "object" && (node as any).type?.displayName === "SelectItem";
}

function collectItems(node: React.ReactNode, acc: Array<{ value: string; label: string }>) {
  React.Children.forEach(node, (child) => {
    if (!child) return;
    if (isSelectItemElement(child)) {
      acc.push({ value: child.props.value, label: String(child.props.children ?? child.props.value) });
      return;
    }
    if (typeof child === "object" && (child as any).props?.children) {
      collectItems((child as any).props.children, acc);
    }
  });
}

export const Select: React.FC<SelectRootProps> = ({ value, onValueChange, disabled, children }) => {
  const items: Array<{ value: string; label: string }> = [];
  collectItems(children, items);
  return (
    <div className="relative">
      <select
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        disabled={disabled}
      >
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
      {/* Render children for compatibility; hidden by default */}
      <div className="hidden" aria-hidden>
        {children}
      </div>
    </div>
  );
};

export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const SelectValue: React.FC<{ placeholder?: string } & React.HTMLAttributes<HTMLSpanElement>> = ({ placeholder, children, ...props }) => (
  <span {...props}>{children ?? placeholder ?? ""}</span>
);

export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const SelectItem: React.FC<SelectItemProps> = ({ children }) => {
  return <>{children}</>;
};
SelectItem.displayName = "SelectItem";

export default Select;


