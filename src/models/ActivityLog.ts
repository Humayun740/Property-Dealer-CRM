import { model, models, Schema } from "mongoose";

const activityLogSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const ActivityLog = models.ActivityLog || model("ActivityLog", activityLogSchema);

export default ActivityLog;
