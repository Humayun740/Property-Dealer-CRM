import { redirect } from "next/navigation";
import LeadManager from "@/components/LeadManager";
import { getServerUser } from "@/lib/auth";

export default async function LeadsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">Lead Management</h2>
      <p className="text-sm text-slate-600">
        Admin can create/assign/delete. Agents can only update their assigned leads.
      </p>
      <LeadManager role={user.role} />
    </section>
  );
}
