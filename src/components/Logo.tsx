// Logo Vetex PC : le symbole (V en circuit imprimé et flèche montante) et le nom, aux couleurs de la marque.
export function Logo() {
  return (
    <span className="logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vetex-icone.svg" alt="" className="logo-mark" width={36} height={36} />
      <span className="logo-word">
        Vete<span className="logo-x">x</span>
        <span className="logo-pc">PC</span>
      </span>
    </span>
  );
}
