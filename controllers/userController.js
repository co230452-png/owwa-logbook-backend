const User = require('../models/User');
const Attendance = require('../models/Attendance');
const QRCode = require('qrcode');

// @desc    Get all pending users
// @route   GET /api/users/pending
// @access  Admin
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'pending', role: 'user' })
      .select('-password -qrCode')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching pending users' });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getAllUsers = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = { role: 'user' };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { owwaId: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password -qrCode')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// @desc    Approve or reject a user
// @route   PATCH /api/users/:id/status
// @access  Admin
const updateUserStatus = async (req, res) => {
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot change admin status' });
    }

    user.status = status;

    // Generate QR code if approving and no QR exists
    if (status === 'approved' && !user.qrCode) {
      const qrPayload = JSON.stringify({ userId: user._id.toString() });
      user.qrCode = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });
    }

    await user.save();

    res.json({
      message: `User has been ${status} successfully`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
};

// @desc    Get single user details (admin view)
// @route   GET /api/users/:id
// @access  Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get attendance count for this user
    const attendanceCount = await Attendance.countDocuments({ userId: user._id });

    res.json({ ...user.toObject(), attendanceCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin accounts' });
    }

    await User.findByIdAndDelete(req.params.id);
    // Also delete their attendance records
    await Attendance.deleteMany({ userId: req.params.id });

    res.json({ message: 'User and attendance records deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// @desc    Get dashboard stats for admin
// @route   GET /api/users/stats
// @access  Admin
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalUsers, pendingUsers, approvedUsers, todayAttendance, totalAttendance] =
      await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'user', status: 'pending' }),
        User.countDocuments({ role: 'user', status: 'approved' }),
        Attendance.countDocuments({ date: today }),
        Attendance.countDocuments(),
      ]);

    res.json({
      totalUsers,
      pendingUsers,
      approvedUsers,
      todayAttendance,
      totalAttendance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching stats' });
  }
};

module.exports = {
  getPendingUsers,
  getAllUsers,
  updateUserStatus,
  getUserById,
  deleteUser,
  getDashboardStats,
};
