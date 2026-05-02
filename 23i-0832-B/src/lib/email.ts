import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(payload: EmailPayload) {
  if (!hasSmtpConfig()) {
    console.log("[EMAIL SKIPPED - SMTP not configured]", {
      to: payload.to,
      subject: payload.subject,
    });
    return { sent: false };
  }

  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || "Property Dealer CRM <no-reply@crm.local>";

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  return { sent: true };
}

export async function sendBulkEmail(
  recipients: string[],
  content: { subject: string; html: string; text: string },
) {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

  if (uniqueRecipients.length === 0) {
    return;
  }

  await Promise.all(
    uniqueRecipients.map((to) =>
      sendEmail({
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    ),
  );
}
