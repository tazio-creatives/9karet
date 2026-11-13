import { Link } from 'react-router-dom';
import styles from './Breadcrumbs.module.css';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      <ol className={styles.list}>
        <li>
          <Link to="/">Home</Link>
        </li>
        {items.map((item, i) => (
          <li key={i}>
            <span className={styles.sep} aria-hidden="true">
              /
            </span>
            {item.href ? <Link to={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
