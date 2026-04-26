import { z } from "zod";
import { LEAD_STATUS, USER_ROLES } from "@/lib/constants";

const budgetSchema = z.coerce.number().positive();

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(6).max(50),
  role: z.enum(USER_ROLES).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(50),
});

export const createLeadSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  phone: z.string().min(7).max(20).optional(),
  source: z.string().min(2).max(100).optional(),
  propertyInterest: z.string().min(2).max(120),
  budget: budgetSchema,
  status: z.enum(LEAD_STATUS).optional(),
  notes: z.string().max(1000).optional(),
  assignedTo: z.string().optional(),
  followUpDate: z.coerce.date().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.email().optional(),
  phone: z.string().min(7).max(20).optional(),
  source: z.string().min(2).max(100).optional(),
  propertyInterest: z.string().min(2).max(120).optional(),
  budget: budgetSchema.optional(),
  status: z.enum(LEAD_STATUS).optional(),
  notes: z.string().max(1000).optional(),
  assignedTo: z.string().optional(),
  followUpDate: z.coerce.date().nullable().optional(),
});

export const assignLeadSchema = z.object({
  assignedTo: z.string().min(3),
});
