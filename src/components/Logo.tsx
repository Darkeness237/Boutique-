// Le logo : un wafer de silicium (le disque d'où sont découpées les puces) réduit à sa grille.
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13 30.6h6" stroke="var(--paper)" strokeWidth="3" />
        <g fill="currentColor">
          <rect x="9" y="9" width="6" height="6" rx="0.8" />
          <rect x="17" y="9" width="6" height="6" rx="0.8" className="logo-die" />
          <rect x="9" y="17" width="6" height="6" rx="0.8" />
          <rect x="17" y="17" width="6" height="6" rx="0.8" />
        </g>
      </svg>
      <span className="logo-word">Silicium</span>
    </span>
  );
}
