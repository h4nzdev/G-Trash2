const mongoose = require("mongoose");

const rewardGoalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Reward name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    pointsRequired: {
      type: Number,
      required: [true, "Goal/required points is required"],
      min: [1, "Points must be at least 1"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 10,
    },
    claimedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock", "archived"],
      default: "active",
    },
    claimValidityDays: {
      type: Number,
      default: 30, // Expiration duration in days after a resident claims the reward
      min: [1, "Claim validity must be at least 1 day"],
    },
    expirationDate: {
      type: Date,
      default: null, // Optional overall expiry date for the reward goal promotion
    },
    category: {
      type: String,
      enum: [
        "essentials",
        "merchandise",
        "vouchers",
        "utilities",
        "certificates",
        "other",
      ],
      default: "essentials",
    },
    barangay: {
      type: String,
      required: [true, "Barangay is required"],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Official",
      default: null,
    },
    createdByName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for remaining stock
rewardGoalSchema.virtual("remainingQuantity").get(function () {
  return Math.max(0, (this.quantity || 0) - (this.claimedCount || 0));
});

// Middleware to automatically set status if stock depleted
rewardGoalSchema.pre("save", function (next) {
  if (this.isActive) {
    if (this.quantity != null && this.claimedCount >= this.quantity) {
      this.status = "out_of_stock";
    } else {
      this.status = "active";
    }
  } else {
    this.status = "inactive";
  }
  next();
});

module.exports =
  mongoose.models.RewardGoal || mongoose.model("RewardGoal", rewardGoalSchema);
