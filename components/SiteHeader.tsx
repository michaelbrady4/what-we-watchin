import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        What we watchin?
      </Link>
      <nav>
        <ThemeToggle />
        <Link className="nav-link" href="/history">
          Past nights
        </Link>
      </nav>
    </header>
  );
}
