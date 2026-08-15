interface Props {
  children: React.ReactNode;
}

/** Mono uppercase kicker above section headings. */
export default function Eyebrow({ children }: Props) {
  return <p className="mono">{children}</p>;
}
