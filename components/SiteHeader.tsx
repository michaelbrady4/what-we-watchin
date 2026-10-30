import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        What we watchin?
      </Link>
      <nav>
        <Link className="nav-link" href="/history">
          Past nights
        </Link>
      </nav>
    </header>
  );
}
