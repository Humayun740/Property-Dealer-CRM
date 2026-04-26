export const AUTH_COOKIE_NAME = "crm_session";

export const LEAD_STATUS = [
  "New",
  "Contacted",
  "In Progress",
  "Closed",
  "Lost",
] as const;

export const LEAD_PRIORITY = ["High", "Medium", "Low"] as const;

export const USER_ROLES = ["admin", "agent"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type LeadStatus = (typeof LEAD_STATUS)[number];
export type LeadPriority = (typeof LEAD_PRIORITY)[number];
