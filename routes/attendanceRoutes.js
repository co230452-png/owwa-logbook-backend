const express = require('express');
const {
  logAttendance,
  editSlot,
  clearSlot,
  getAllAttendance,
  getMyAttendance,
  getTodayAttendance,
  deleteAttendance,
} = require('../controllers/attendanceController');
const { protect, adminOnly, approvedOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// User route
router.get('/my',    protect, approvedOnly, getMyAttendance);

// Admin routes
router.post('/log',           protect, adminOnly, logAttendance);
router.get('/',               protect, adminOnly, getAllAttendance);
router.get('/today',          protect, adminOnly, getTodayAttendance);
router.patch('/:id/slot',     protect, adminOnly, editSlot);
router.delete('/:id/slot/:slot', protect, adminOnly, clearSlot);
router.delete('/:id',         protect, adminOnly, deleteAttendance);

module.exports = router;
