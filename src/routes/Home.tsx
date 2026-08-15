import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import FloodStoryTimeline from "@/components/sections/FloodStoryTimeline";
import ProductCard from "@/components/sections/ProductCard";
import StatIconRow from "@/components/sections/StatIconRow";
import IndustryGrid from "@/components/sections/IndustryGrid";
import ClosingCtaBand from "@/components/sections/ClosingCtaBand";
import ExplorerPreview from "@/components/product/ExplorerPreview";
import LivePreview from "@/components/product/LivePreview";
import { products } from "@/content/home";

const previews = {
  "district-map": <ExplorerPreview />,
  "phone-radar": <LivePreview />,
};

/**
 * Homepage. Section order is the contract — it mirrors the reference
 * mockup and should not drift without checking against it.
 */
export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* 2 */} <Hero />
        {/* 3 */} <FloodStoryTimeline />

        {/* 4 — same component, two instances */}
        <section aria-label="Products">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              name={p.name}
              tagline={p.tagline}
              tiers={p.tiers}
              cta={p.cta}
              preview={previews[p.preview]}
              reversed={i % 2 === 1}
            />
          ))}
        </section>

        {/* 5 */} <StatIconRow />
        {/* 6 */} <IndustryGrid />

        {/* Candidate slot for <DitherHelix /> — see components/motion/DitherHelix.tsx */}

        {/* 7 */} <ClosingCtaBand />
      </main>
      {/* 8 */} <Footer />
    </>
  );
}
