import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { getServerUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ActivityPage({ searchParams }: PageProps) {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const params = (await searchParams) || {};
  const query = (params.q || "").trim();

  await connectDB();

  const filter: Record<string, unknown> = {};

  if (query) {
    filter.$or = [
      { action: { $regex: query, $options: "i" } },
      { message: { $regex: query, $options: "i" } },
    ];
  }

  if (user.role !== "admin") {
    const assignedLeads = await Lead.find({
      assignedTo: new Types.ObjectId(user.userId),
    }).select("_id");

    const leadIds = assignedLeads.map((lead) => lead._id);
    filter.leadId = { $in: leadIds };
  }

  const activities = await ActivityLog.find(filter)
    .populate("leadId", "name")
    .populate("actorId", "name email role")
    .sort({ createdAt: -1 })
    .limit(200);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Activity Timeline</h2>
        <p className="text-sm text-slate-600">
          Showing the latest 200 activity events for your accessible leads.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by action or message"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
        >
          Search
        </button>
      </form>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-600">No activity found.</p>
        ) : (
          activities.map((activity) => (
            <article key={String(activity._id)} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {activity.message}
                </p>
                <span className="text-xs text-slate-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Action: {activity.action}
              </p>
              <p className="text-xs text-slate-600">
                Lead: {(activity.leadId as { name?: string })?.name || "Unknown"}
              </p>
              <p className="text-xs text-slate-600">
                Actor: {(activity.actorId as { name?: string; email?: string })?.name ||
                  (activity.actorId as { email?: string })?.email || "System"}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
