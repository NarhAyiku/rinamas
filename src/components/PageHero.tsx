/** The steel title band at the top of the inner public pages (/hire, /hire/[slug], /regions/[slug]).
 *  Carries id="top" so the phone StickyBar appears once it scrolls away, as on the landing page. */
export function PageHero({ crumbs, eyebrow, title, sub }: { crumbs: [string, string][]; eyebrow: string; title: string; sub?: React.ReactNode }) {
  return (
    <section className="hero page-hero" id="top">
      <div className="hero-glow" aria-hidden="true" />
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>{crumbs.map(([label, href], i) => <li key={href}>{i < crumbs.length - 1 ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}</li>)}</ol>
        </nav>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="hero-sub">{sub}</p>}
      </div>
    </section>
  );
}
