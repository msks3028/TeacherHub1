import { forwardRef } from "react";
import Icon from "./Icon";

/**
 * variant: primary | secondary | ghost | soft | danger | dangerSolid
 * size:    sm | md | lg        iconOnly → square button (needs aria-label)
 * loading: shows a spinner, keeps the width, blocks clicks.
 * as:      render as another element/component (e.g. Link) — pass `to`, `href`…
 */
const Button = forwardRef(function Button(
  { children, variant = "primary", size = "md", loading = false, icon, iconOnly = false, className = "", as: As = "button", disabled, type, ...props },
  ref
) {
  const v = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost", soft: "btn-soft", danger: "btn-danger", dangerSolid: "btn-danger-solid" }[variant] || "btn-primary";
  const s = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const cls = `btn ${v} ${s} ${iconOnly ? "btn-icon" : ""} ${className}`;
  const iconSize = iconOnly || size === "lg" ? 20 : 16;
  const isBtn = As === "button";

  return (
    <As
      ref={ref}
      className={cls}
      {...(isBtn ? { type: type || "button", disabled: disabled || loading } : { "aria-disabled": disabled || loading || undefined })}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon icon={icon} size={iconSize} /> : null}
      {!iconOnly && children}
      {iconOnly && !icon && children}
    </As>
  );
});

export default Button;
