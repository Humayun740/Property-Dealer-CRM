import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { Types } from "mongoose";
import { getRequestUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";

type LeadRow = {
  name: string;
  email: string;
  phone: string;
  source: string;
  propertyInterest: string;
  budget: number;
  status: string;
  priority: string;
  assignedTo?: { name?: string } | null;
  createdAt: Date;
};

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }

  return value;
}

function buildCsv(leads: LeadRow[]) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Source",
    "Property Interest",
    "Budget",
    "Status",
    "Priority",
    "Assigned To",
    "Created At",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.email,
    lead.phone || "",
    lead.source,
    lead.propertyInterest,
    String(lead.budget),
    lead.status,
    lead.priority,
    lead.assignedTo?.name || "Unassigned",
    lead.createdAt.toISOString(),
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map((value) => escapeCsvValue(value)).join(","),
  );

  return lines.join("\n");
}

function buildPdf(leads: LeadRow[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Property Dealer CRM - Leads Export");
    doc.moveDown();

    leads.forEach((lead, index) => {
      doc
        .fontSize(11)
        .text(
          `${index + 1}. ${lead.name} | ${lead.status} | ${lead.priority} | PKR ${lead.budget.toLocaleString()}`,
        )
        .fontSize(9)
        .fillColor("#475569")
        .text(`Email: ${lead.email}`)
        .text(`Interest: ${lead.propertyInterest}`)
        .text(`Assigned: ${lead.assignedTo?.name || "Unassigned"}`)
        .text(`Created: ${lead.createdAt.toLocaleDateString()}`)
        .fillColor("#0f172a")
        .moveDown(0.6);
    });

    doc.end();
  });
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const format = request.nextUrl.searchParams.get("format") || "csv";
  const status = request.nextUrl.searchParams.get("status");
  const priority = request.nextUrl.searchParams.get("priority");
  const query = request.nextUrl.searchParams.get("q");

  const filter: Record<string, unknown> = {};

  if (user.role !== "admin") {
    filter.assignedTo = new Types.ObjectId(user.userId);
  }

  if (status) {
    filter.status = status;
  }

  if (priority) {
    filter.priority = priority;
  }

  if (query) {
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { propertyInterest: { $regex: query, $options: "i" } },
    ];
  }

  const leads = (await Lead.find(filter)
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 })) as unknown as LeadRow[];

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const pdfBuffer = await buildPdf(leads);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=leads-export-${timestamp}.pdf`,
      },
    });
  }

  const csv = buildCsv(leads);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=leads-export-${timestamp}.csv`,
    },
  });
}
