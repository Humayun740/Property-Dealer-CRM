import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import User from "@/models/User";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  await connectDB();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const baseFilter =
    user.role === "agent" ? { assignedTo: new Types.ObjectId(user.userId) } : {};

  const totalLeads = await Lead.countDocuments(baseFilter);

  const statusAgg = await Lead.aggregate([
    { $match: baseFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const priorityAgg = await Lead.aggregate([
    { $match: baseFilter },
    { $group: { _id: "$priority", count: { $sum: 1 } } },
  ]);

  const statusOrder = ["New", "Contacted", "In Progress", "Closed", "Lost"];
  const priorityOrder = ["High", "Medium", "Low"];

  const statusCounts = new Map(statusAgg.map((item) => [item._id, item.count]));
  const priorityCounts = new Map(priorityAgg.map((item) => [item._id, item.count]));

  const statusChart = statusOrder.map((label) => {
    const count = statusCounts.get(label) || 0;
    const percent = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
    return { label, count, percent };
  });

  const priorityChart = priorityOrder.map((label) => {
    const count = priorityCounts.get(label) || 0;
    const percent = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
    return { label, count, percent };
  });

  const overdueCount = await Lead.countDocuments({
    ...baseFilter,
    followUpDate: { $lt: now },
    status: { $nin: ["Closed", "Lost"] },
  });

  const staleCount = await Lead.countDocuments({
    ...baseFilter,
    lastActivityAt: { $lt: staleCutoff },
    status: { $nin: ["Closed", "Lost"] },
  });

  const agentAgg =
    user.role === "admin"
      ? await Lead.aggregate([
          { $match: { assignedTo: { $ne: null } } },
          { $group: { _id: "$assignedTo", handled: { $sum: 1 } } },
          { $sort: { handled: -1 } },
        ])
      : [];

  const agentIds = agentAgg.map((entry) => entry._id).filter(Boolean);
  const agents =
    user.role === "admin" && agentIds.length > 0
      ? await User.find({ _id: { $in: agentIds } }).select("name")
      : [];

  const agentNameMap = new Map(agents.map((agent) => [String(agent._id), agent.name]));

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Leads</p>
          <p className="text-2xl font-bold text-slate-900">{totalLeads}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">High Priority</p>
          <p className="text-2xl font-bold text-rose-700">
            {priorityAgg.find((item) => item._id === "High")?.count || 0}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Medium Priority</p>
          <p className="text-2xl font-bold text-amber-700">
            {priorityAgg.find((item) => item._id === "Medium")?.count || 0}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Low Priority</p>
          <p className="text-2xl font-bold text-slate-700">
            {priorityAgg.find((item) => item._id === "Low")?.count || 0}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Overdue Follow-ups</p>
          <p className="text-2xl font-bold text-rose-700">{overdueCount}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Stale Leads (3+ days)</p>
          <p className="text-2xl font-bold text-amber-700">{staleCount}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Status Distribution</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {statusAgg.length === 0 ? (
              <li>No data available yet.</li>
            ) : (
              statusAgg.map((item) => (
                <li key={item._id} className="flex justify-between rounded bg-slate-50 p-2">
                  <span>{item._id}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))
            )}
          </ul>
        </article>

        {user.role === "admin" && (
          <article className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Agent Performance</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {agentAgg.length === 0 ? (
                <li>No assigned leads yet.</li>
              ) : (
                agentAgg.map((item) => (
                  <li key={String(item._id)} className="flex justify-between rounded bg-slate-50 p-2">
                    <span>{agentNameMap.get(String(item._id)) || "Unknown Agent"}</span>
                    <span className="font-semibold">{item.handled}</span>
                  </li>
                ))
              )}
            </ul>
          </article>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Status Chart</h2>
          <div className="mt-3 space-y-3">
            {statusChart.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Priority Chart</h2>
          <div className="mt-3 space-y-3">
            {priorityChart.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${
                      item.label === "High"
                        ? "bg-rose-500"
                        : item.label === "Medium"
                          ? "bg-amber-500"
                          : "bg-slate-500"
                    }`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
