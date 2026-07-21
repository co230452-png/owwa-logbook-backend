const express = require('express');
const {
  getPendingUsers, getAllUsers, updateUserStatus, getUserById,
  deleteUser, setDefaultPassword, changePassword, updateProfile, getDashboardStats,
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Self-service routes — any logged-in user
router.patch('/change-password', protect, changePassword);
router.patch('/update-profile',  protect, updateProfile);

// Admin only routes
router.use(protect, adminOnly);
router.get('/stats', getDashboardStats);
router.get('/pending', getPendingUsers);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/status', updateUserStatus);
router.patch('/:id/default-password', setDefaultPassword);
router.delete('/:id', deleteUser);

module.exports = router;
