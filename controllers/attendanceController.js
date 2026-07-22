const Attendance = require('../models/Attendance');
const User = require('../models/User');

const BUFFER_MINUTES = 5;

/**
 * Determine which slot to fill based on current time and record state.
 *
 * Rules:
 * 1. If morningIn exists but morningOut is empty → always morningOut (regardless of time)
 * 2. If morningIn and morningOut both exist → move to afternoon slots
 * 3. If no morningIn and time is before 12:00 → morningIn
 * 4. If no morningIn and time is after 12:00 → skip morning, go to afternoonIn
 * 5. If afternoonIn exists but afternoonOut empty → afternoonOut
 */
function nextSlot(record, now) {
  const hour = now.getHours();
  const isAfternoon = hour >= 12;

  // Priority 1: If they scanned morning in, next must be morning out
  if (record.morningIn && !record.morningOut) {
    return { slot: 'morningOut', label: 'Morning Out' };
  }

  // Priority 2: If morning is complete or skipped, handle afternoon
  if (record.afternoonIn && !record.afternoonOut) {
    return { slot: 'afternoonOut', label: 'Afternoon Out' };
  }

  // Priority 3: No morning in yet
  if (!record.morningIn) {
    if (!isAfternoon) {
      // Before noon — start with morning in
      return { slot: 'morningIn', label: 'Morning In' };
    } else {
      // After noon — skip morning, go straight to afternoon
      if (!record.afternoonIn) return { slot: 'afternoonIn', label: 'Afternoon In' };
    }
  }

  // Priority 4: Morning complete, start afternoon
  if (record.morningIn && record.morningOut && !record.afternoonIn) {
    return { slot: 'afternoonIn', label: 'Afternoon In' };
  }

  return null; // All slots filled
}

/** Get the most recently filled slot timestamp */
function lastScanTime(record) {
  const times = [record.morningIn, record.morningOut, record.afternoonIn, record.afternoonOut]
    .filter(Boolean)
    .map(t => new Date(t).getTime());
  if (!times.length) return null;
  return new Date(Math.max(...times));
}

function buildSummary(record) {
  const fmt = (d) => d
    ? new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    : '—';
  return {
    morningIn:      fmt(record.morningIn),
    morningOut:     fmt(record.morningOut),
    afternoonIn:    fmt(record.afternoonIn),
    afternoonOut:   fmt(record.afternoonOut),
    totalMinutes:   record.totalMinutes,
    totalFormatted: formatMinutes(record.totalMinutes),
  };
}

function formatMinutes(mins) {
  if (!mins) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// @desc    Log attendance via QR scan
// @route   POST /api/attendance/log
// @access  Admin
const logAttendance = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'User ID is required' });

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found. Invalid QR code.' });

    if (user.status !== 'approved') {
      return res.status(403).json({
        message: `Cannot log: account is ${user.status}`,
        user: { firstName: user.firstName, lastName: user.lastName },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();

    let record = await Attendance.findOne({ userId, date: today });
    if (!record) {
      record = new Attendance({ userId, date: today, scannedBy: req.user._id });
    }

    // 5-minute buffer check
    const last = lastScanTime(record);
    if (last) {
      const diffMinutes = (now - last) / 60000;
      if (diffMinutes < BUFFER_MINUTES) {
        const waitSecs = Math.ceil((BUFFER_MINUTES * 60) - (diffMinutes * 60));
        const waitMins = Math.ceil(waitSecs / 60);
        return res.status(429).json({
          message: `Please wait ${waitMins} minute${waitMins !== 1 ? 's' : ''} before scanning again. Last scan was ${Math.floor(diffMinutes * 60)} seconds ago.`,
          tooSoon: true,
          waitSeconds: waitSecs,
          user: { firstName: user.firstName, lastName: user.lastName },
        });
      }
    }

    // Get next slot based on time of day
    const next = nextSlot(record, now);
    if (!next) {
      return res.status(409).json({
        message: `All log slots for ${user.firstName} ${user.lastName} are filled for today.`,
        allFilled: true,
        user: { firstName: user.firstName, lastName: user.lastName },
        record,
      });
    }

    record[next.slot] = now;
    record.scannedBy  = req.user._id;
    record.computeTotal();
    await record.save();

    res.status(200).json({
      message: `${user.firstName} ${user.lastName} — ${next.label} logged at ${now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`,
      slot:    next.slot,
      label:   next.label,
      record,
      summary: buildSummary(record),
      user: {
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, owwaId: user.owwaId,
      },
    });
  } catch (error) {
    console.error('Log attendance error:', error);
    if (error.code === 11000) return res.status(409).json({ message: 'Duplicate entry — please try again.' });
    res.status(500).json({ message: 'Server error logging attendance' });
  }
};

// @desc    Edit a specific time slot
// @route   PATCH /api/attendance/:id/slot
// @access  Admin
const editSlot = async (req, res) => {
  const { slot, value } = req.body;
  const validSlots = ['morningIn', 'morningOut', 'afternoonIn', 'afternoonOut'];
  if (!validSlots.includes(slot)) {
    return res.status(400).json({ message: 'Invalid slot' });
  }
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (value === null || value === '') {
      record[slot] = null;
    } else {
      const [hours, minutes] = value.split(':').map(Number);
      const dt = new Date(`${record.date}T00:00:00`);
      dt.setHours(hours, minutes, 0, 0);
      record[slot] = dt;
    }

    record.computeTotal();
    await record.save();
    await record.populate('userId', 'firstName lastName email owwaId phone');

    res.json({ message: `${slot} updated successfully`, record, summary: buildSummary(record) });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating slot' });
  }
};

// @desc    Clear a specific slot
// @route   DELETE /api/attendance/:id/slot/:slot
// @access  Admin
const clearSlot = async (req, res) => {
  const validSlots = ['morningIn', 'morningOut', 'afternoonIn', 'afternoonOut'];
  const { slot } = req.params;
  if (!validSlots.includes(slot)) return res.status(400).json({ message: 'Invalid slot' });
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    record[slot] = null;
    record.computeTotal();
    await record.save();
    res.json({ message: `${slot} cleared`, record });
  } catch (error) {
    res.status(500).json({ message: 'Server error clearing slot' });
  }
};

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Admin
const getAllAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId, search, page = 1, limit = 50 } = req.query;
    let query = {};
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    else if (startDate) query.date = { $gte: startDate };
    else if (endDate)   query.date = { $lte: endDate };
    if (userId) query.userId = userId;

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName:  { $regex: search, $options: 'i' } },
          { owwaId:    { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.userId = { $in: matchingUsers.map(u => u._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate('userId', 'firstName lastName email owwaId phone')
        .populate('scannedBy', 'firstName lastName')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching attendance' });
  }
};

// @desc    Get today's attendance
// @route   GET /api/attendance/today
// @access  Admin
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: today })
      .populate('userId', 'firstName lastName email owwaId')
      .sort({ updatedAt: -1 });
    res.json({ date: today, count: records.length, records });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get logged-in user's own attendance
// @route   GET /api/attendance/my
// @access  Private (approved)
const getMyAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find({ userId: req.user._id }).sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments({ userId: req.user._id }),
    ]);
    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Admin
const deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  logAttendance, editSlot, clearSlot,
  getAllAttendance, getMyAttendance, getTodayAttendance, deleteAttendance,
};
