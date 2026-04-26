import type { LeadPriority } from "@/lib/constants";

export function getLeadPriorityAndScore(budget: number): {
  priority: LeadPriority;
  score: number;
} {
  if (budget > 20_000_000) {
    return { priority: "High", score: 90 };
  }

  if (budget >= 10_000_000) {
    return { priority: "Medium", score: 60 };
  }

  return { priority: "Low", score: 30 };
}
