const { Schema } = require("mongoose");

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    isAdmin: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = function (mongoose: any) {
  return mongoose.models?.User || mongoose.model("User", UserSchema);
};
