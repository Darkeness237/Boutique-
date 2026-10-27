// Bandeau défilant. Le contenu est doublé pour boucler sans saut ; la copie est cachée
// aux lecteurs d'écran. Il s'arrête au survol et ne bouge pas si l'utilisateur a
// demandé à réduire les animations.
export function Ticker({ items, label, tone = "light" }: { items: string[]; label: string; tone?: "light" | "dark" }) {
  return (
    <section className={`ticker ticker-${tone}`} aria-label={label}>
      <div className="ticker-track">
        <ul>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <ul aria-hidden="true">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
