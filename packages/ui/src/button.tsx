import {
  ActionIcon,
  Button,
  type ActionIconProps,
  type ButtonProps,
  type ElementProps,
} from "@mantine/core";
import type { ReactNode } from "react";

export type GssButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";

const buttonVariants = {
  danger: { color: "red", mantineVariant: "light" },
  ghost: { color: "gray", mantineVariant: "subtle" },
  outline: { color: "gss", mantineVariant: "outline" },
  primary: { color: "gss", mantineVariant: "filled" },
  secondary: { color: "gray", mantineVariant: "light" },
  soft: { color: "gssCyan", mantineVariant: "light" },
} as const;

export type GssButtonProps = Omit<ButtonProps & ElementProps<"button">, "color" | "variant"> & {
  variant?: GssButtonVariant;
  children?: ReactNode;
};

export function GssButton({ className, variant = "primary", ...props }: GssButtonProps) {
  const config = buttonVariants[variant];
  return (
    <Button
      {...props}
      className={
        className
          ? `gss-button gss-button-${variant} ${className}`
          : `gss-button gss-button-${variant}`
      }
      color={config.color}
      variant={config.mantineVariant}
    />
  );
}

export type GssIconButtonProps = Omit<
  ActionIconProps & ElementProps<"button">,
  "color" | "variant"
> & {
  variant?: "default" | "soft" | "danger";
  children?: ReactNode;
};

export function GssIconButton({ className, variant = "default", ...props }: GssIconButtonProps) {
  const color = variant === "danger" ? "red" : variant === "soft" ? "gssCyan" : "gss";
  const mantineVariant = variant === "default" ? "subtle" : "light";
  return (
    <ActionIcon
      {...props}
      className={className ? `gss-icon-button ${className}` : "gss-icon-button"}
      color={color}
      variant={mantineVariant}
    />
  );
}
