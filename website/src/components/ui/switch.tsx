import type { ComponentProps } from "react";
import "./switch.css";

type SwitchProps = Omit<ComponentProps<"input">, "type" | "role" | "onChange"> & {
  onCheckedChange?: (checked: boolean) => void;
};

// Native checkbox semantics and keyboard behavior, styled as a switch with CSS.
export function Switch({ className = "", checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <input
      {...props}
      type="checkbox"
      role="switch"
      checked={checked}
      aria-checked={checked}
      className={`ui-switch ${className}`}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  );
}
