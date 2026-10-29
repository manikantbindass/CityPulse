import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Map,
  Sparkles,
  ShieldCheck,
  Layers,
  ChartNoAxesCombined,
} from 'lucide-react';
import { CityNetwork } from './network';
import { Button } from './ui/button';
export function MarketingNav() {
  return (
    <nav className="marketing-nav" aria-label="Main">
      <Link href="/" className="brand">
        <span className="brand-icon">cp</span>citypulse<span className="brand-dot">.</span>
      </Link>
      <div>
        <Link href="/features">Platform</Link>
        <Link href="/help">Documentation</Link>
        <Link href="/login">Sign in</Link>
        <Button asChild size="sm">
          <Link href="/dashboard">
            Explore workspace <ArrowUpRight size={14} />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
const features = [
  {
    icon: Map,
    title: 'Ground every signal',
    text: 'PostGIS registry and provenance-aware observation schema.',
    href: '/explorer',
  },
  {
    icon: Sparkles,
    title: 'Start with a baseline',
    text: 'A validated linear forecast endpoint; model evaluation comes next.',
    href: '/predictions',
  },
  {
    icon: ShieldCheck,
    title: 'Make evidence traceable',
    text: 'An owner-scoped Solidity digest registry for a local development chain.',
    href: '/verification',
  },
];
export function MarketingHome() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="marketing-hero">
        <div>
          <p className="hero-eyebrow">
            <span className="status-dot connected" />
            URBAN INTELLIGENCE, CONNECTED
          </p>
          <h1>
            Understand the city.
            <br />
            <span>Anticipate its needs.</span>
          </h1>
          <p>
            A connected foundation for urban supply, demand, and accountable decisions. Built around
            geography. Designed for evidence.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/dashboard">
                Explore the foundation <ArrowUpRight size={16} />
              </Link>
            </Button>
            <Link href="/features" className="text-action">
              Discover the platform <ArrowRight size={16} />
            </Link>
          </div>
          <p className="hero-disclaimer">Local preview · synthetic fixtures · no live city feeds</p>
        </div>
        <div className="hero-network">
          <div className="network-heading">
            <span>DEMO CITY / SPATIAL SIGNAL</span>
            <span className="text-mint">● CONCEPT VIEW</span>
          </div>
          <CityNetwork />
          <div className="network-caption">
            <span>
              <Activity size={15} />A city of connected possibilities
            </span>
            <span>01 / 06</span>
          </div>
        </div>
      </section>
      <div className="stack-strip">
        <span>BUILT ON A CLEAR FOUNDATION</span>
        <span>Next.js</span>
        <span>Spring Boot</span>
        <span>PostGIS</span>
        <span>scikit-learn</span>
        <span>Solidity</span>
      </div>
      <section className="marketing-features">
        <div className="section-intro">
          <p className="eyebrow">ONE CONNECTED PERSPECTIVE</p>
          <h2>
            Every signal has a place.
            <br />
            <span>Every decision needs context.</span>
          </h2>
          <p>
            Explore the foundation for understanding what a city has, what it needs, and where to
            look next.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((item) => (
            <article key={item.title}>
              <item.icon size={26} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <Link href={item.href}>
                Explore <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-close">
        <p className="eyebrow">A FOUNDATION TO BUILD UPON</p>
        <h2>
          A better question.
          <br />
          <span>A clearer city.</span>
        </h2>
        <Button asChild>
          <Link href="/dashboard">
            Open the sample workspace <ArrowUpRight size={16} />
          </Link>
        </Button>
      </section>
      <footer className="marketing-footer">
        <Link href="/" className="brand">
          citypulse.
        </Link>
        <p>Understanding city supply and demand using AI and blockchain.</p>
        <Link href="/help">
          Help & documentation <ArrowUpRight size={14} />
        </Link>
      </footer>
    </main>
  );
}
export function FeaturesPage() {
  const items = [
    ...features,
    {
      icon: ChartNoAxesCombined,
      title: 'Supply & demand',
      text: 'Compare, search, and export synthetic district observations.',
      href: '/intelligence',
    },
    {
      icon: Layers,
      title: 'Resource planning',
      text: 'Explore proportional allocation to sample supply gaps.',
      href: '/optimization',
    },
    {
      icon: Activity,
      title: 'Reports & analyst',
      text: 'Build CSV reports or ask the rule-based local analyst about sample data.',
      href: '/reports',
    },
  ];
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="features-hero">
        <p className="eyebrow">THE PLATFORM</p>
        <h1>
          A city is connected.
          <br />
          <span>Your intelligence should be too.</span>
        </h1>
        <p>
          Explore six connected capabilities. Synthetic data and visible limits guide the current
          foundation.
        </p>
      </section>
      <section className="feature-grid features-full">
        {items.map((item) => (
          <article key={item.title}>
            <item.icon size={28} />
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <Link href={item.href}>
              Open workspace <ArrowUpRight size={14} />
            </Link>
          </article>
        ))}
      </section>
      <footer className="marketing-footer">
        <Link href="/">CityPulse</Link>
        <Link href="/dashboard">Explore workspace →</Link>
      </footer>
    </main>
  );
}
