import { ForwarderForm, InviteForm } from "@/components/transit/TransitForms";
import { supabaseForUser } from "@/lib/supabase-server";
import { revokeStaff } from "@/lib/transit-actions";

type Forwarder = { id: string; name: string; contact_email: string | null; phone: string | null; warehouse_address: string | null };
type Member = { user_id: string; email: string; role: "admin" | "forwarder"; forwarder_id: string | null };
type Invite = { email: string; role: string; forwarder_id: string | null; accepted_at: string | null };

export default async function Forwarders() {
  const supabase = await supabaseForUser();
  const [{ data: forwarders }, { data: members }, { data: invites }] = await Promise.all([
    supabase.from("forwarders").select("id, name, contact_email, phone, warehouse_address").order("name").returns<Forwarder[]>(),
    supabase.rpc("admin_staff"),
    supabase.from("staff_invites").select("email, role, forwarder_id, accepted_at").is("accepted_at", null).returns<Invite[]>(),
  ]);
  const people = (members ?? []) as Member[];
  const options = (forwarders ?? []).map((f) => ({ id: f.id, name: f.name }));
  const peopleOf = (id: string | null) => people.filter((m) => m.forwarder_id === id);
  const pendingOf = (id: string | null) => (invites ?? []).filter((i) => i.forwarder_id === id);

  return (
    <>
      <div className="page-head">
        <h1>Transitaires et accès</h1>
        <p className="lede">
          Créez la société, puis invitez ses employés par e-mail. Ils créent leur compte sur{" "}
          <strong>/transitaire/inscription</strong> avec cette adresse, ou se connectent avec Google : l&apos;accès s&apos;active
          tout seul, limité aux expéditions de leur société.
        </p>
      </div>
      <div className="transit-grid">
        <div className="transit-main">
          {[...(forwarders ?? []), { id: null, name: "Administrateurs", contact_email: null, phone: null, warehouse_address: null }].map((f) => (
            <section key={f.id ?? "admins"} className="account-card">
              <h2>{f.name}</h2>
              {(f.contact_email || f.phone || f.warehouse_address) && (
                <p className="field-hint">{[f.contact_email, f.phone, f.warehouse_address].filter(Boolean).join(" · ")}</p>
              )}
              <ul className="member-list">
                {peopleOf(f.id).map((m) => (
                  <li key={m.user_id}>
                    <span>{m.email}</span>
                    <span className="pill">Actif</span>
                    <form action={revokeStaff}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input type="hidden" name="email" value={m.email} />
                      <button className="link-btn">Retirer l&apos;accès</button>
                    </form>
                  </li>
                ))}
                {pendingOf(f.id).map((i) => (
                  <li key={i.email}>
                    <span>{i.email}</span>
                    <span className="pill pill-warn">Invitation en attente</span>
                    <form action={revokeStaff}>
                      <input type="hidden" name="email" value={i.email} />
                      <button className="link-btn">Annuler</button>
                    </form>
                  </li>
                ))}
                {peopleOf(f.id).length + pendingOf(f.id).length === 0 && <li className="field-hint">Personne pour l&apos;instant.</li>}
              </ul>
            </section>
          ))}
        </div>
        <aside className="transit-side">
          <section className="account-card">
            <h2>Inviter une personne</h2>
            <InviteForm forwarders={options} />
          </section>
          <section className="account-card">
            <h2>Nouvelle société de transit</h2>
            <ForwarderForm />
          </section>
        </aside>
      </div>
    </>
  );
}
