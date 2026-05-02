"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Agent = {
  _id: string;
  name: string;
  email: string;
};

type Lead = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  propertyInterest: string;
  budget: number;
  status: string;
  notes?: string;
  priority: "High" | "Medium" | "Low";
  score: number;
  followUpDate?: string | null;
  assignedTo?: { _id: string; name: string; email: string } | null;
  updatedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
};

type ActivityItem = {
  _id: string;
  action: string;
  message: string;
  createdAt: string;
  actorId?: {
    name?: string;
    email?: string;
  };
};

type Suggestion = {
  title: string;
  action: string;
  reason: string;
};

type Props = {
  role: "admin" | "agent";
};

type NewLeadForm = {
  name: string;
  email: string;
  phone: string;
  source: string;
  propertyInterest: string;
  budget: string;
  notes: string;
  assignedTo: string;
};

const initialLeadForm: NewLeadForm = {
  name: "",
  email: "",
  phone: "",
  source: "Facebook Ads",
  propertyInterest: "",
  budget: "",
  notes: "",
  assignedTo: "",
};

export default function LeadManager({ role }: Props) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [liveMessage, setLiveMessage] = useState("Polling every 8s");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newLead, setNewLead] = useState<NewLeadForm>(initialLeadForm);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timelineByLead, setTimelineByLead] = useState<Record<string, ActivityItem[]>>({});
  const [timelineOpenByLead, setTimelineOpenByLead] = useState<Record<string, boolean>>({});
  const [timelineLoadingByLead, setTimelineLoadingByLead] = useState<Record<string, boolean>>({});
  const [suggestionsByLead, setSuggestionsByLead] = useState<Record<string, Suggestion>>({});
  const leadSnapshotRef = useRef<
    Record<string, { priority: string; assignedTo: string; updatedAt: string }>
  >({});

  function createSnapshot(items: Lead[]) {
    return items.reduce<Record<string, { priority: string; assignedTo: string; updatedAt: string }>>(
      (acc, lead) => {
        acc[lead._id] = {
          priority: lead.priority,
          assignedTo: lead.assignedTo?._id || "",
          updatedAt: lead.updatedAt || "",
        };
        return acc;
      },
      {},
    );
  }

  function detectLiveChanges(nextLeads: Lead[]) {
    const previous = leadSnapshotRef.current;
    const next = createSnapshot(nextLeads);

    let newLeadCount = 0;
    let assignmentChanged = 0;
    let priorityChanged = 0;

    for (const lead of nextLeads) {
      const previousLead = previous[lead._id];

      if (!previousLead) {
        newLeadCount += 1;
        continue;
      }

      if (previousLead.assignedTo !== (lead.assignedTo?._id || "")) {
        assignmentChanged += 1;
      }

      if (previousLead.priority !== lead.priority) {
        priorityChanged += 1;
      }
    }

    leadSnapshotRef.current = next;

    const updates: string[] = [];
    if (newLeadCount > 0) {
      updates.push(`${newLeadCount} new lead${newLeadCount > 1 ? "s" : ""}`);
    }
    if (assignmentChanged > 0) {
      updates.push(`${assignmentChanged} assignment update${assignmentChanged > 1 ? "s" : ""}`);
    }
    if (priorityChanged > 0) {
      updates.push(`${priorityChanged} priority update${priorityChanged > 1 ? "s" : ""}`);
    }

    if (updates.length > 0) {
      setLiveMessage(`Live updates: ${updates.join(" | ")}`);
    } else {
      setLiveMessage(`Polling every 8s - last sync ${new Date().toLocaleTimeString()}`);
    }
  }

  async function loadLeads(options?: { silent?: boolean; compareLive?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    const params = new URLSearchParams();

    if (statusFilter) {
      params.set("status", statusFilter);
    }

    if (priorityFilter) {
      params.set("priority", priorityFilter);
    }

    if (search.trim()) {
      params.set("q", search.trim());
    }

    const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Failed to load leads");
      setLoading(false);
      return;
    }

    const incomingLeads: Lead[] = data.leads || [];
    setLeads(incomingLeads);

    if (incomingLeads.length > 0) {
      void loadSuggestions(incomingLeads.map((lead) => lead._id));
    }

    if (options?.compareLive) {
      detectLiveChanges(incomingLeads);
    } else {
      leadSnapshotRef.current = createSnapshot(incomingLeads);
    }

    setLoading(false);
  }

  async function loadAgents() {
    if (role !== "admin") {
      return;
    }

    const res = await fetch("/api/users/agents", { cache: "no-store" });
    const data = await res.json();

    if (res.ok) {
      setAgents(data.agents || []);
    }
  }

  async function loadSuggestions(ids: string[]) {
    const params = new URLSearchParams();
    params.set("ids", ids.join(","));

    const res = await fetch(`/api/leads/suggestions?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok) {
      setSuggestionsByLead(data.suggestions || {});
    }
  }

  useEffect(() => {
    const initialize = async () => {
      await loadLeads({ silent: true });
      await loadAgents();
    };

    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    const poller = window.setInterval(() => {
      void loadLeads({ silent: true, compareLive: true });
    }, 8000);

    return () => window.clearInterval(poller);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(ticker);
  }, []);

  async function handleToggleTimeline(leadId: string) {
    const isOpen = timelineOpenByLead[leadId];
    if (isOpen) {
      setTimelineOpenByLead((prev) => ({ ...prev, [leadId]: false }));
      return;
    }

    setTimelineOpenByLead((prev) => ({ ...prev, [leadId]: true }));

    if (timelineByLead[leadId]) {
      return;
    }

    setTimelineLoadingByLead((prev) => ({ ...prev, [leadId]: true }));

    const res = await fetch(`/api/leads/${leadId}/activities`, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Failed to load timeline");
      setTimelineLoadingByLead((prev) => ({ ...prev, [leadId]: false }));
      return;
    }

    setTimelineByLead((prev) => ({ ...prev, [leadId]: data.activities || [] }));
    setTimelineLoadingByLead((prev) => ({ ...prev, [leadId]: false }));
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const payload = {
      name: newLead.name,
      email: newLead.email,
      phone: newLead.phone,
      source: newLead.source,
      propertyInterest: newLead.propertyInterest,
      budget: Number(newLead.budget),
      notes: newLead.notes,
      assignedTo: newLead.assignedTo || undefined,
    };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Failed to create lead");
      return;
    }

    setMessage("Lead created successfully");
    setNewLead(initialLeadForm);
    await loadLeads();
  }

  async function handleSaveLead(lead: Lead, fields: Record<string, unknown>) {
    setMessage("");

    const res = await fetch(`/api/leads/${lead._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Update failed");
      return;
    }

    setLeads((prev) => prev.map((item) => (item._id === lead._id ? data.lead : item)));
    setMessage("Lead updated");
  }

  async function handleAssignLead(leadId: string, assignedTo: string) {
    if (!assignedTo) {
      return;
    }

    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Assignment failed");
      return;
    }

    setLeads((prev) => prev.map((item) => (item._id === leadId ? data.lead : item)));
    setMessage("Lead assigned");
  }

  async function handleDeleteLead(leadId: string) {
    const ok = window.confirm("Delete this lead?");
    if (!ok) {
      return;
    }

    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Delete failed");
      return;
    }

    setLeads((prev) => prev.filter((item) => item._id !== leadId));
    setMessage("Lead deleted");
  }

  async function handleExport(format: "csv" | "pdf") {
    const params = new URLSearchParams();
    params.set("format", format);

    if (statusFilter) {
      params.set("status", statusFilter);
    }

    if (priorityFilter) {
      params.set("priority", priorityFilter);
    }

    if (search.trim()) {
      params.set("q", search.trim());
    }

    const res = await fetch(`/api/leads/export?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Export failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileExt = format === "pdf" ? "pdf" : "csv";
    link.href = url;
    link.download = `leads-export.${fileExt}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const overdueCount = useMemo(() => {
    return leads.filter(
      (lead) =>
        lead.followUpDate &&
        new Date(lead.followUpDate).getTime() < nowMs &&
        !["Closed", "Lost"].includes(lead.status),
    ).length;
  }, [leads, nowMs]);

  const staleCount = useMemo(() => {
    const staleCutoff = nowMs - 3 * 24 * 60 * 60 * 1000;

    return leads.filter(
      (lead) =>
        lead.lastActivityAt &&
        new Date(lead.lastActivityAt).getTime() < staleCutoff &&
        !["Closed", "Lost"].includes(lead.status),
    ).length;
  }, [leads, nowMs]);

  return (
    <div className="space-y-5">
      {role === "admin" && (
        <form
          onSubmit={handleCreateLead}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
        >
          <input
            value={newLead.name}
            onChange={(e) => setNewLead((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Client name"
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
          <input
            type="email"
            value={newLead.email}
            onChange={(e) => setNewLead((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
          <input
            value={newLead.phone}
            onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            value={newLead.propertyInterest}
            onChange={(e) =>
              setNewLead((prev) => ({ ...prev, propertyInterest: e.target.value }))
            }
            placeholder="Property interest"
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
          <input
            value={newLead.budget}
            onChange={(e) => setNewLead((prev) => ({ ...prev, budget: e.target.value }))}
            placeholder="Budget (e.g. 15000000)"
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
          <select
            value={newLead.source}
            onChange={(e) => setNewLead((prev) => ({ ...prev, source: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="Facebook Ads">Facebook Ads</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Website">Website</option>
          </select>
          <textarea
            value={newLead.notes}
            onChange={(e) => setNewLead((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes"
            className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2"
            rows={2}
          />
          <select
            value={newLead.assignedTo}
            onChange={(e) => setNewLead((prev) => ({ ...prev, assignedTo: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Assign later</option>
            {agents.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 md:col-span-3"
          >
            Create Lead
          </button>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">All statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
            <option value="Lost">Lost</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">All priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button
            onClick={() => void loadLeads()}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Apply Filters
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => void handleExport("csv")}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Export CSV (Excel)
          </button>
          <button
            onClick={() => void handleExport("pdf")}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Export PDF
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <span>Total: {leads.length}</span>
          <span>Overdue follow-ups: {overdueCount}</span>
          <span>Stale leads (3+ days): {staleCount}</span>
          <span className="font-medium text-emerald-700">{liveMessage}</span>
        </div>

        {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}

        {loading ? (
          <p className="text-sm text-slate-600">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-slate-600">No leads found.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <article
                key={lead._id}
                className={`rounded-lg border p-4 ${
                  lead.followUpDate &&
                  new Date(lead.followUpDate).getTime() < nowMs &&
                  !["Closed", "Lost"].includes(lead.status)
                    ? "border-rose-300 bg-rose-50/30"
                    : lead.lastActivityAt &&
                        new Date(lead.lastActivityAt).getTime() <
                          nowMs - 3 * 24 * 60 * 60 * 1000 &&
                        !["Closed", "Lost"].includes(lead.status)
                      ? "border-amber-300 bg-amber-50/30"
                      : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{lead.name}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      lead.priority === "High"
                        ? "bg-rose-100 text-rose-800"
                        : lead.priority === "Medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {lead.priority} ({lead.score})
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-700">{lead.email}</p>
                <p className="text-sm text-slate-700">Interest: {lead.propertyInterest}</p>
                <p className="text-sm text-slate-700">
                  Budget: PKR {Number(lead.budget).toLocaleString()}
                </p>
                <p className="text-sm text-slate-700">
                  Assigned: {lead.assignedTo?.name || "Unassigned"}
                </p>
                {lead.followUpDate &&
                  new Date(lead.followUpDate).getTime() < nowMs &&
                  !["Closed", "Lost"].includes(lead.status) && (
                    <p className="text-xs font-semibold text-rose-700">Follow-up overdue</p>
                  )}
                {lead.lastActivityAt &&
                  new Date(lead.lastActivityAt).getTime() <
                    nowMs - 3 * 24 * 60 * 60 * 1000 &&
                  !["Closed", "Lost"].includes(lead.status) && (
                    <p className="text-xs font-semibold text-amber-700">Lead inactive for 3+ days</p>
                  )}
                {lead.phone && (
                  <a
                    className="text-sm font-medium text-emerald-700 hover:underline"
                    href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp Chat
                  </a>
                )}

                {suggestionsByLead[lead._id] && (
                  <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-2 text-xs text-emerald-900">
                    <p className="font-semibold">
                      AI Suggestion: {suggestionsByLead[lead._id].title}
                    </p>
                    <p>{suggestionsByLead[lead._id].action}</p>
                    <p className="text-emerald-700">
                      Reason: {suggestionsByLead[lead._id].reason}
                    </p>
                  </div>
                )}

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <select
                    defaultValue={lead.status}
                    onChange={(e) =>
                      void handleSaveLead(lead, {
                        status: e.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <input
                    type="date"
                    defaultValue={lead.followUpDate ? lead.followUpDate.slice(0, 10) : ""}
                    onChange={(e) =>
                      void handleSaveLead(lead, {
                        followUpDate: e.target.value || null,
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                  />

                  <input
                    defaultValue={lead.notes || ""}
                    onBlur={(e) =>
                      void handleSaveLead(lead, {
                        notes: e.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                    placeholder="Update notes and click outside"
                  />

                  {role === "admin" && (
                    <select
                      defaultValue={lead.assignedTo?._id || ""}
                      onChange={(e) => void handleAssignLead(lead._id, e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                    >
                      <option value="">Assign to agent</option>
                      {agents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {role === "admin" && (
                  <button
                    onClick={() => void handleDeleteLead(lead._id)}
                    className="mt-3 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Delete Lead
                  </button>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => void handleToggleTimeline(lead._id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {timelineOpenByLead[lead._id] ? "Hide Timeline" : "View Timeline"}
                  </button>

                  {timelineOpenByLead[lead._id] && (
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                      {timelineLoadingByLead[lead._id] ? (
                        <p className="text-xs text-slate-600">Loading timeline...</p>
                      ) : (timelineByLead[lead._id] || []).length === 0 ? (
                        <p className="text-xs text-slate-600">No activity found for this lead.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(timelineByLead[lead._id] || []).map((activity) => (
                            <li
                              key={activity._id}
                              className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"
                            >
                              <p className="font-semibold text-slate-800">{activity.message}</p>
                              <p className="text-slate-600">
                                {activity.actorId?.name || activity.actorId?.email || "System"} |{" "}
                                {new Date(activity.createdAt).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
