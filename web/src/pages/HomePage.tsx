import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHomepage } from '../api/homepage';
import { AssuranceStrip } from './home/AssuranceStrip';
import { HomepageSection } from './home/HomepageSection';
import { HomeFaq, HOME_FAQ } from './home/HomeFaq';
import { useHead, defaultHead } from '../seo/head';
import { breadcrumbJsonLd, faqPageJsonLd, organizationJsonLd, websiteJsonLd } from '../seo/jsonLd';
import styles from './HomePage.module.css';

export function HomePage() {
  useHead({
    ...defaultHead,
    jsonLd: [
      organizationJsonLd(),
      websiteJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
      faqPageJsonLd(HOME_FAQ),
    ],
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['homepage'],
    queryFn: fetchHomepage,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={styles.skeleton} aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeletonBlock} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className={styles.error}>Couldn't load the homepage right now.</p>;
  }

  // Only the FIRST Hero section counts — the admin's section list can (and in
  // production does) contain more than one enabled HERO row, and matching on
  // type alone rendered the strip once per row, showing it twice on the page.
  const firstHeroIndex = data.sections.findIndex((s) => s.type === 'HERO');

  return (
    <div className={styles.page}>
      {/* The page's one H1 — the brand otherwise only appears inside the
          logo image. Visually hidden (the hero banner is the visual
          heading) but real text for search engines and screen readers. */}
      <h1 className={styles.visuallyHidden}>BOX DIAMONDS — Certified Natural Diamond Jewellery</h1>
      {data.sections.map((section, i) => (
        <Fragment key={section.id}>
          <HomepageSection section={section} alternate={i % 2 === 1} />
          {/* Static, homepage-only strip — not a homepage_sections row, so
              it's placed here positionally right after HERO rather than in
              HomepageSection.tsx's data-driven switch (plan: "Add only the
              assurance strip" / "Do not add an admin configuration screen"). */}
          {i === firstHeroIndex && <AssuranceStrip />}
        </Fragment>
      ))}
      <HomeFaq />
    </div>
  );
}
