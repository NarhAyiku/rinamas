import { Brand, BadgeDefs } from "./Badge";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <>
      <BadgeDefs />
      <header className="top">
        <div className="wrap">
          <Brand />
          <nav className="nav" aria-label="Sections">
            <a href="/#fleet">Fleet</a>
            <a href="/#rates">Rates</a>
            <a href="/#how">How it works</a>
            <a href="/#coverage">Coverage</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <div className="top-actions">
            <a className="btn btn-ghost btn-sm top-call" href="tel:+233243518749">024 351 8749</a>
            <a className="btn btn-accent btn-sm" href="/#quote">Request a quote</a>
            <MobileNav />
          </div>
        </div>
      </header>
    </>
  );
}
