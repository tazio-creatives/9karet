import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHomepage } from '../api/homepage';
import { HomepageSection } from './home/HomepageSection';
import { useHead, defaultHead } from '../seo/head';
import { breadcrumbJsonLd, organizationJsonLd, websiteJsonLd } from '../seo/jsonLd';
import styles from './HomePage.module.css';

export function HomePage() {
  useHead({
    ...defaultHead,
    jsonLd: [
      organizationJsonLd(),
      websiteJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
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

  return (
    <div className={styles.page}>
      {/* The page's one H1 — the brand otherwise only appears inside the
          logo image. Visually hidden (the hero banner is the visual
          heading) but real text for search engines and screen readers. */}
      <h1 className={styles.visuallyHidden}>9KARET — Smart Gold: 9K Gold &amp; Gemstone Jewellery</h1>
      {data.sections.map((section, i) => (
        <Fragment key={section.id}>
          <HomepageSection section={section} alternate={i % 2 === 1} />
        </Fragment>
      ))}
    </div>
  );
}
