import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales" };

// Modèle à compléter avec les informations réelles de l'entreprise avant la mise en ligne.
export default function LegalPage() {
  return (
    <div className="wrap">
      <article className="prose">
        <h1>Mentions légales</h1>
        <h2>Éditeur du site</h2>
        <p>
          <span className="todo">[Raison sociale]</span>, <span className="todo">[forme juridique]</span> au capital
          de <span className="todo">[montant]</span> €, immatriculée au RCS de <span className="todo">[ville]</span>{" "}
          sous le numéro <span className="todo">[SIREN]</span>.
        </p>
        <p>
          Siège social : <span className="todo">[adresse]</span>. TVA intracommunautaire :{" "}
          <span className="todo">[numéro]</span>.
        </p>
        <p>
          Directeur de la publication : <span className="todo">[nom]</span>. Contact :{" "}
          <span className="todo">[e-mail]</span>, <span className="todo">[téléphone]</span>.
        </p>
        <h2>Hébergement</h2>
        <p>
          Site hébergé par <span className="todo">[Netlify, Inc., 512 2nd Street, San Francisco, CA 94107, États-Unis]</span>.
          Données clients hébergées par <span className="todo">[Supabase, région Union européenne]</span>.
        </p>
        <h2>Médiation de la consommation</h2>
        <p>
          En cas de litige, vous pouvez recourir gratuitement au médiateur :{" "}
          <span className="todo">[nom et site du médiateur]</span>.
        </p>
      </article>
    </div>
  );
}
