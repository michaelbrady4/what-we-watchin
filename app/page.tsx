import { CreateNight } from "@/components/CreateNight";
import { DecorWheel } from "@/components/DecorWheel";
import { JoinNight } from "@/components/JoinNight";
import { SiteHeader } from "@/components/SiteHeader";
import { YourNights } from "@/components/YourNights";

export default function HomePage() {
  return (
    <div className="landing">
      <SiteHeader />
      <p className="spine">For the group chat</p>
      <main className="hero">
        <p className="kicker">
          <span className="lamp" aria-hidden="true" />
          Group chat, one screen
        </p>
        <h1>
          <span>What we</span>
          <span className="accent">watchin?</span>
        </h1>
        <p className="lede">
          Everyone throws up to three shows on the wheel. Somebody locks it. You spin until a single title is
          left, then find out who talked you into it.
        </p>
        <CreateNight />
        <p className="fine">No accounts. The link is the invite.</p>
        <JoinNight />
        <YourNights />
      </main>
      <div className="hero-wheel" aria-hidden="true">
        <DecorWheel />
      </div>
    </div>
  );
}
