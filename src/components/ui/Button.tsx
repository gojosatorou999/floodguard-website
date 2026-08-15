import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  href?: string;
}

/**
 * TODO: real styling. Renders an <a> when href is passed so CTAs that
 * navigate are links, not buttons.
 */
export default function Button({ variant = "primary", href, children, ...rest }: Props) {
  if (href) {
    return <a href={href} data-variant={variant}>{children}</a>;
  }
  return <button type="button" data-variant={variant} {...rest}>{children}</button>;
}
