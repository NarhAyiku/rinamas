import { Brand, BadgeDefs } from "./Badge";

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
          <a className="btn btn-accent" href="/#quote">Request a quote</a>
        </div>
      </header>
    </>
  );
}
