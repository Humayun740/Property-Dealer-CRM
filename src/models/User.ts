import { model, models, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "agent"], default: "agent" },
  },
  { timestamps: true },
);


export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };

const User = models.User || model("User", userSchema);

export default User;
