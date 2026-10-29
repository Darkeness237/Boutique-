// Vocabulaire du transit France → Cameroun, partagé entre l'espace transitaire et l'admin.

export const STATUSES = {
  attendu: "Attendu à l'entrepôt",
  recu: "Reçu à l'entrepôt (Île-de-France)",
  en_preparation: "En préparation / consolidation",
  expedie: "Parti de France",
  arrive_cameroun: "Arrivé au Cameroun",
  dedouane: "Dédouané",
  remis_livreur: "Remis au livreur",
  livre: "Livré au client",
  incident: "Incident",
} as const;
export type ShipmentStatus = keyof typeof STATUSES;

/** Étapes que le transitaire peut déclarer après la réception, dans l'ordre du trajet. */
export const STEPS: ShipmentStatus[] = ["en_preparation", "expedie", "arrive_cameroun", "dedouane", "remis_livreur", "livre", "incident"];
export const ORDERED: ShipmentStatus[] = ["attendu", "recu", "en_preparation", "expedie", "arrive_cameroun", "dedouane", "remis_livreur", "livre"];

export const DOC_KINDS = {
  preuve_export: "Preuve d'export (sortie du territoire)",
  lta: "LTA / connaissement",
  facture_transitaire: "Facture du transitaire",
  declaration_douane: "Déclaration en douane (Cameroun)",
  photo_reception: "Photo à la réception",
  bon_livraison: "Bon de livraison signé",
  autre: "Autre document",
} as const;
export type DocKind = keyof typeof DOC_KINDS;

export const CONDITIONS = { ok: "En bon état", abime: "Colis abîmé", incomplet: "Incomplet" } as const;

export const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};
export const MAX_UPLOAD = 15 * 1024 * 1024;

export type Shipment = {
  id: string;
  number: string;
  forwarder_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_city: string | null;
  contents: string;
  supplier_tracking: string | null;
  expected_parcels: number | null;
  expected_weight_kg: number | null;
  received_parcels: number | null;
  received_weight_kg: number | null;
  received_condition: keyof typeof CONDITIONS | null;
  received_at: string | null;
  transport_mode: "aerien" | "maritime" | null;
  awb_number: string | null;
  carrier: string | null;
  departed_at: string | null;
  eta: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  status: ShipmentStatus;
  forwarder_activity_at: string | null;
  admin_seen_at: string | null;
  created_at: string;
};
export const SHIPMENT_COLUMNS =
  "id, number, forwarder_id, order_number, customer_name, customer_city, contents, supplier_tracking, expected_parcels, expected_weight_kg, received_parcels, received_weight_kg, received_condition, received_at, transport_mode, awb_number, carrier, departed_at, eta, arrived_at, delivered_at, status, forwarder_activity_at, admin_seen_at, created_at";

export type ShipmentEvent = {
  id: number;
  kind: "statut" | "message" | "document";
  status: ShipmentStatus | null;
  location: string | null;
  message: string | null;
  author_role: "admin" | "forwarder";
  created_at: string;
};
export type ShipmentDocument = {
  id: string;
  kind: DocKind;
  filename: string;
  size_bytes: number | null;
  uploader_role: "admin" | "forwarder";
  created_at: string;
};

/** Parti de France depuis plus de 7 jours sans preuve d'export : la vente hors TVA n'est pas justifiée. */
export function missingExportProof(s: Pick<Shipment, "departed_at">, docs: Pick<ShipmentDocument, "kind">[], now = Date.now()) {
  if (!s.departed_at) return false;
  if (docs.some((d) => d.kind === "preuve_export")) return false;
  return now - Date.parse(s.departed_at) > 7 * 86_400_000;
}

export const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
export const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
