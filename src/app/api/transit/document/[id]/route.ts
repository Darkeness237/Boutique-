import { NextResponse, type NextRequest } from "next/server";
import { supabaseForUser } from "@/lib/supabase-server";

// Ouvre un document de transit : lien signé valable une minute, délivré seulement si la politique
// d'accès de la base autorise ce compte (admin, ou transitaire chargé de l'expédition).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const supabase = await supabaseForUser();
  const { data: doc } = await supabase
    .from("shipment_documents")
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle<{ storage_path: string; filename: string }>();
  if (!doc) return new NextResponse("Introuvable", { status: 404 });
  const { data, error } = await supabase.storage.from("transit").createSignedUrl(doc.storage_path, 60, { download: doc.filename });
  if (error || !data) return new NextResponse("Indisponible", { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
