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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </section>
  );
}
