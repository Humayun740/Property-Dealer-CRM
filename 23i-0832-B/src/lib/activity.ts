import ActivityLog from "@/models/ActivityLog";

type LogInput = {
  leadId: string;
  actorId: string;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
};

export async function logActivity(input: LogInput) {
  await ActivityLog.create(input);
}
