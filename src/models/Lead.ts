import { model, models, Schema, type InferSchemaType } from "mongoose";
import { getLeadPriorityAndScore } from "@/lib/scoring";

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    source: { type: String, default: "Walk-in" },
    propertyInterest: { type: String, required: true },
    budget: { type: Number, required: true },
    status: {
      type: String,
      enum: ["New", "Contacted", "In Progress", "Closed", "Lost"],
      default: "New",
    },
    notes: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 30 },
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Low" },
    followUpDate: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

leadSchema.pre("validate", function preValidate() {
  if (typeof this.budget === "number") {
    const { priority, score } = getLeadPriorityAndScore(this.budget);
    this.priority = priority;
    this.score = score;
  }

  this.lastActivityAt = new Date();
});

export type LeadDocument = InferSchemaType<typeof leadSchema> & { _id: string };

const Lead = models.Lead || model("Lead", leadSchema);

export default Lead;
