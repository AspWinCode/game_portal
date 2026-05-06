import Link from "next/link";
import type { Route } from "next";

export function ChildEmptyState({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: {
  title: string;
  description: string;
  primaryHref: Route;
  primaryLabel: string;
  secondaryHref?: Route;
  secondaryLabel?: string;
}) {
  return (
    <div className="container">
      <section className="card accent-card stack empty-state">
        <div className="eyebrow">Mission Status</div>
        <h1 className="section-title" style={{ fontSize: 36 }}>
          {title}
        </h1>
        <p className="subtle" style={{ maxWidth: 620 }}>
          {description}
        </p>
        <div className="button-row">
          <Link className="button" href={primaryHref}>
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link className="button-secondary" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
