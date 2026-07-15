const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    // Morning session
    morningIn: { type: Date, default: null },
    morningOut: { type: Date, default: null },
    // Afternoon session
    afternoonIn: { type: Date, default: null },
    afternoonOut: { type: Date, default: null },
    // Total minutes logged (computed on each scan)
    totalMinutes: { type: Number, default: 0 },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Helper: recompute totalMinutes from the four time fields
attendanceSchema.methods.computeTotal = function () {
  let mins = 0;
  if (this.morningIn && this.morningOut) {
    mins += (this.morningOut - this.morningIn) / 60000;
  }
  if (this.afternoonIn && this.afternoonOut) {
    mins += (this.afternoonOut - this.afternoonIn) / 60000;
  }
  this.totalMinutes = Math.round(mins);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
