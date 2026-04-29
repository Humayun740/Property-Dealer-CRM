type Suggestion = {
  title: string;
  action: string;
  reason: string;
};

type LeadInput = {
  name: string;
  status: string;
  priority: string;
  budget: number;
  followUpDate?: Date | null;
  lastActivityAt?: Date | null;
};

export function buildLeadSuggestion(lead: LeadInput): Suggestion {
  const now = Date.now();
  const followUpAt = lead.followUpDate ? lead.followUpDate.getTime() : null;
  const lastActivityAt = lead.lastActivityAt ? lead.lastActivityAt.getTime() : null;

  if (followUpAt && followUpAt < now && !["Closed", "Lost"].includes(lead.status)) {
    return {
      title: "Overdue follow-up",
      action: "Call today and confirm next steps. Update notes after the call.",
      reason: "Follow-up date has already passed.",
    };
  }

  if (!followUpAt && !["Closed", "Lost"].includes(lead.status)) {
    return {
      title: "Set a follow-up date",
      action: "Schedule a follow-up within 48 hours and send a short WhatsApp update.",
      reason: "No follow-up date is assigned yet.",
    };
  }

  if (lastActivityAt && lastActivityAt < now - 3 * 24 * 60 * 60 * 1000) {
    return {
      title: "Lead is getting cold",
      action: "Re-engage with a new offer or site visit option.",
      reason: "No activity for more than 3 days.",
    };
  }

  if (lead.status === "New" && lead.priority === "High") {
    return {
      title: "High priority new lead",
      action: "Call within 2 hours and offer a site visit.",
      reason: "High budget with new status.",
    };
  }

  if (lead.status === "Contacted") {
    return {
      title: "Keep momentum",
      action: "Share brochure and propose a short meeting this week.",
      reason: "Lead already contacted but not progressed.",
    };
  }

  if (lead.status === "In Progress") {
    return {
      title: "Move towards closing",
      action: "Confirm budget range and send an updated property shortlist.",
      reason: "Lead is in active negotiation stage.",
    };
  }

  return {
    title: "Maintain relationship",
    action: "Send a friendly update and ask for next preferences.",
    reason: "Standard follow-up is recommended.",
  };
}
