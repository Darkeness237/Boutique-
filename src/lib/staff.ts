import { redirect } from "next/navigation";
import { currentUser, supabaseForUser } from "./supabase-server";

export type Staff = { userId: string; email: string | null; role: "admin" | "forwarder"; forwarderId: string | null };

/** Rôle du compte connecté (admin, transitaire) ou null pour un client. */
export async function getStaff(): Promise<Staff | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await supabaseForUser();
  const { data } = await supabase
    .from("staff_roles")
    .select("role, forwarder_id")
    .eq("user_id", user.id)
    .maybeSingle<{ role: "admin" | "forwarder"; forwarder_id: string | null }>();
  if (!data) return null;
  return { userId: user.id, email: user.email ?? null, role: data.role, forwarderId: data.forwarder_id };
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/connexion");
  if (staff.role !== "admin") redirect("/compte");
  return staff;
}

export async function requireForwarder(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/transitaire/connexion");
  if (staff.role === "admin") redirect("/admin");
  return staff;
}

/** Page d'accueil après connexion selon le rôle. */
export async function homeFor(userId: string): Promise<string> {
  const supabase = await supabaseForUser();
  const { data } = await supabase.from("staff_roles").select("role").eq("user_id", userId).maybeSingle<{ role: string }>();
  return data?.role === "admin" ? "/admin" : data?.role === "forwarder" ? "/transitaire" : "/compte";
}
