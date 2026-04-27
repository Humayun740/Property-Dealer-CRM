function formatCurrencyPKR(amount: number) {
  return `PKR ${amount.toLocaleString()}`;
}

type NewLeadEmailInput = {
  leadName: string;
  propertyInterest: string;
  budget: number;
  priority: string;
  source: string;
};

type AssignmentEmailInput = {
  agentName: string;
  leadName: string;
  propertyInterest: string;
  budget: number;
  priority: string;
};

export function buildNewLeadEmail(input: NewLeadEmailInput) {
  const subject = `New Lead Added: ${input.leadName}`;

  const text = [
    "A new lead has been created.",
    `Name: ${input.leadName}`,
    `Interest: ${input.propertyInterest}`,
    `Budget: ${formatCurrencyPKR(input.budget)}`,
    `Priority: ${input.priority}`,
    `Source: ${input.source}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a;">
      <h2 style="margin-bottom:8px;">New Lead Created</h2>
      <p>A new lead has been added in Property Dealer CRM.</p>
      <ul>
        <li><strong>Name:</strong> ${input.leadName}</li>
        <li><strong>Interest:</strong> ${input.propertyInterest}</li>
        <li><strong>Budget:</strong> ${formatCurrencyPKR(input.budget)}</li>
        <li><strong>Priority:</strong> ${input.priority}</li>
        <li><strong>Source:</strong> ${input.source}</li>
      </ul>
    </div>
  `;

  return { subject, text, html };
}

export function buildLeadAssignedEmail(input: AssignmentEmailInput) {
  const subject = `Lead Assigned: ${input.leadName}`;

  const text = [
    `Dear ${input.agentName},`,
    "A lead has been assigned to you.",
    `Lead: ${input.leadName}`,
    `Interest: ${input.propertyInterest}`,
    `Budget: ${formatCurrencyPKR(input.budget)}`,
    `Priority: ${input.priority}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a;">
      <h2 style="margin-bottom:8px;">Lead Assigned to You</h2>
      <p>Dear ${input.agentName}, a lead has been assigned to your pipeline.</p>
      <ul>
        <li><strong>Lead:</strong> ${input.leadName}</li>
        <li><strong>Interest:</strong> ${input.propertyInterest}</li>
        <li><strong>Budget:</strong> ${formatCurrencyPKR(input.budget)}</li>
        <li><strong>Priority:</strong> ${input.priority}</li>
      </ul>
      <p>Please follow up as soon as possible.</p>
    </div>
  `;

  return { subject, text, html };
}
