// Rendu d'un processeur vu de dessus, quand le fabricant ne fournit pas de photo (AMD et Intel ne publient pas
// leurs visuels dans le catalogue ouvert). La forme suit le socket réel et le capot porte le marquage du modèle,
// comme sur la puce. Aucun logo de marque n'est reproduit : seul le nom est gravé, en texte.

type Cpu = { brand: string; name: string; socket: string | null };

/** « Processeur AMD Ryzen 7 9800X3D (5,2 GHz) AM5 WOF » → { family: "RYZEN 7", model: "9800X3D" }. */
export function cpuMarking(name: string): { family: string; model: string } {
  const clean = name
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(processeur|amd|intel|wof|box|tray|mpk|sbx|version|bo[iî]te|oem|sans ventilateur|sans igpu|am4|am5|lga ?\d{4})\b/gi, " ")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fam = clean.match(/(ryzen threadripper( pro)?|threadripper( pro)?|ryzen \d( pro)?|core ultra \d|core i\d|core(?= \d{3}\b)|pentium( gold)?|celeron|athlon|xeon( silver| gold)?|epyc)/i);
  const family = (fam?.[0] ?? clean.split(" ").slice(0, 2).join(" ")).toUpperCase().replace(/CORE I(\d)/, "CORE i$1");
  const rest = fam ? clean.slice((fam.index ?? 0) + fam[0].length) : clean;
  const base = (rest.match(/\b[A-Z]?\d{3,5}[A-Z0-9]*\b/i)?.[0] ?? "").toUpperCase();
  const model = /\bplus\b/i.test(rest) ? `${base} PLUS` : base;
  return { family, model };
}

export function CpuVisual({ brand, name, socket }: Cpu) {
  const amd = /amd/i.test(brand) || /ryzen|athlon|threadripper|epyc/i.test(name);
  const { family, model } = cpuMarking(name);
  // Socket absent du fichier fournisseur : déduit de la génération (Ryzen 7000 et plus = AM5).
  const gen = Number(model.match(/^\d/)?.[0] ?? 0);
  const s = (socket ?? (amd && /^RYZEN \d/.test(family) ? (gen >= 7 && model.length >= 4 ? "AM5" : "AM4") : "")).toUpperCase();
  const intel = !amd;
  const am5 = s === "AM5";
  const tr = /threadripper/i.test(name);

  // Dimensions (unités de dessin) : Intel LGA est rectangulaire, AMD carré, Threadripper très grand.
  const sub = intel ? { w: 150, h: 180 } : tr ? { w: 176, h: 176 } : { w: 164, h: 164 };
  const cx = 120, cy = 120;
  const sx = cx - sub.w / 2, sy = cy - sub.h / 2;
  const ihs = intel ? { w: 122, h: 128 } : tr ? { w: 150, h: 150 } : am5 ? { w: 132, h: 132 } : { w: 136, h: 136 };
  const ix = cx - ihs.w / 2, iy = cy - ihs.h / 2 + (intel ? -8 : 0);
  // Taille du texte ajustée à la largeur du capot (un chiffre fait environ 0,68 fois la hauteur du caractère).
  const fit = (text: string, max: number) => Math.min(max, (ihs.w - 26) / (Math.max(text.length, 1) * 0.68));
  const id = `${amd ? "a" : "i"}${am5 ? 5 : 4}`;

  return (
    <svg className="cpu-visual" viewBox="0 0 240 240" role="img" aria-label={`${brand} ${family} ${model}`}>
      <defs>
        <linearGradient id={`ihs-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f5f7" />
          <stop offset="0.45" stopColor="#c9ccd3" />
          <stop offset="0.7" stopColor="#e6e8ec" />
          <stop offset="1" stopColor="#a9aeb8" />
        </linearGradient>
        <linearGradient id={`pcb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={amd ? "#1f6b45" : "#2a6a3b"} />
          <stop offset="1" stopColor={amd ? "#134a30" : "#1b4d29"} />
        </linearGradient>
        <filter id={`sh-${id}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1c2029" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Substrat (circuit vert) */}
      <g filter={`url(#sh-${id})`}>
        <rect x={sx} y={sy} width={sub.w} height={sub.h} rx="5" fill={`url(#pcb-${id})`} />
        {/* Encoches de détrompage Intel */}
        {intel && (
          <>
            <rect x={sx - 1} y={sy + 34} width="7" height="12" fill="#fff" />
            <rect x={sx + sub.w - 6} y={sy + 34} width="7" height="12" fill="#fff" />
          </>
        )}
        {/* Composants CMS visibles autour du capot AM5 et en bas des puces Intel */}
        {am5 &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} fill="#c58b3a">
              <rect x={sx + 10} y={sy + 46 + i * 12} width="9" height="4" rx="1" />
              <rect x={sx + sub.w - 19} y={sy + 46 + i * 12} width="9" height="4" rx="1" />
            </g>
          ))}
        {intel &&
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={sx + 22 + i * 14} y={sy + sub.h - 20} width="8" height="4" rx="1" fill="#c58b3a" />
          ))}
        {/* Repère d'orientation (triangle doré) */}
        <path d={`M${sx + 6} ${sy + sub.h - 6}l14 0l-14 -14z`} fill="#d4a63c" />
      </g>

      {/* Capot métallique (IHS) */}
      {am5 ? (
        <path
          d={`M${ix + 8} ${iy} h${ihs.w - 16} q8 0 8 8 v28 h-10 v12 h10 v${ihs.h - 96} h-10 v12 h10 v28 q0 8 -8 8 h-${ihs.w - 16} q-8 0 -8 -8 v-28 h10 v-12 h-10 v-${ihs.h - 96} h10 v-12 h-10 v-28 q0 -8 8 -8z`}
          fill={`url(#ihs-${id})`}
          stroke="#8d939e"
          strokeWidth="1"
        />
      ) : (
        <rect x={ix} y={iy} width={ihs.w} height={ihs.h} rx="7" fill={`url(#ihs-${id})`} stroke="#8d939e" strokeWidth="1" />
      )}

      {/* Marquage gravé */}
      <g fill="#4a505c" fontFamily="'Archivo Variable', Arial, sans-serif" textAnchor="middle">
        <text x={cx} y={iy + ihs.h * 0.34} fontSize={intel ? 22 : 26} fontWeight="800" letterSpacing="1">
          {amd ? "AMD" : "intel"}
        </text>
        <text x={cx} y={iy + ihs.h * 0.53} fontSize={fit(family, 15)} fontWeight="700" letterSpacing="0.6">
          {family}
        </text>
        <text x={cx} y={iy + ihs.h * 0.7} fontSize={fit(model, 22)} fontWeight="800" letterSpacing="0.4">
          {model}
        </text>
        <text x={cx} y={iy + ihs.h * 0.86} fontSize="8" opacity="0.7" letterSpacing="0.8">
          {s ? `SOCKET ${s}` : ""}
        </text>
      </g>
    </svg>
  );
}
