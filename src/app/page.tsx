import { CtaBanner } from "@/components/home/CtaBanner";
import { Faq } from "@/components/home/Faq";
import { Hero } from "@/components/home/Hero";
import { HomeNav } from "@/components/home/HomeNav";
import { JaydenMode } from "@/components/home/JaydenMode";
import { NetworkTicker } from "@/components/home/NetworkTicker";
import { SignalConsole } from "@/components/home/SignalConsole";
import { Toaster } from "@/components/home/Toaster";
import { PlanCards } from "@/components/site/PlanCards";
import { SiteFooter } from "@/components/site/SiteFooter";

/**
 * The original homepage, rebuilt: ticker, navigation, hero, the nine plans,
 * the Signal Calibration Console, FAQ and closing banner. Static: no session
 * reads, no database. Interactive pieces run in the browser only.
 */
export default function Home() {
  return (
    <>
      <NetworkTicker />
      <HomeNav />
      <main id="main">
        <Hero />
        <PlanCards />
        <SignalConsole />
        <Faq />
        <CtaBanner />
      </main>
      <SiteFooter />
      <Toaster />
      <JaydenMode />
    </>
  );
}
