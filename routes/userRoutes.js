const express = require('express');
const {
  getPendingUsers,
  getAllUsers,
  updateUserStatus,
  getUserById,
  deleteUser,
  getDashboardStats,
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication + admin role
router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingUsers);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/status', updateUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
