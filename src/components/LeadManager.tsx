"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  createdAt: string;
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newLead, setNewLead] = useState<NewLeadForm>(initialLeadForm);
  const [mountedAt] = useState(() => Date.now());

  async function loadLeads(options?: { silent?: boolean }) {
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

    setLeads(data.leads || []);
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

  useEffect(() => {
    const initialize = async () => {
      await loadLeads({ silent: true });
      await loadAgents();
    };

    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

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

  const overdueCount = useMemo(() => {
    return leads.filter(
      (lead) =>
        lead.followUpDate && new Date(lead.followUpDate).getTime() < mountedAt,
    ).length;
  }, [leads, mountedAt]);

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

        <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <span>Total: {leads.length}</span>
          <span>Overdue follow-ups: {overdueCount}</span>
        </div>

        {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}

        {loading ? (
          <p className="text-sm text-slate-600">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-slate-600">No leads found.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <article key={lead._id} className="rounded-lg border border-slate-200 p-4">
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
