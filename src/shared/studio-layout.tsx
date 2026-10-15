import type { ReactNode } from 'react';

/** Presentation only: each module supplies its own content and business state. */
export function StudioLayout({
  testId,
  className,
  title,
  introduction,
  children,
}: {
  readonly testId: string;
  readonly className: string;
  readonly title: string;
  readonly introduction: string;
  readonly children: ReactNode;
}) {
  return (
    <section data-testid={testId} className={className}>
      <p className="eyebrow">CREATIVE STUDIO</p>
      <h1>{title}</h1>
      <p className="page-intro">{introduction}</p>
      {children}
    </section>
  );
}
