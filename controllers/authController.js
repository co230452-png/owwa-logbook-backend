const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const QRCode = require('qrcode');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { firstName, lastName, email, phone, owwaId, address, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      owwaId: owwaId || '',
      address: address || '',
      password,
      role: 'user',
      status: 'pending',
    });

    // Generate QR Code with user ID
    const qrPayload = JSON.stringify({ userId: user._id.toString() });
    const qrCode = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    });

    // Save QR code to user
    user.qrCode = qrCode;
    await user.save();

    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval.',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check account status
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is awaiting admin approval' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account has been rejected. Please contact the administrator.' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        owwaId: user.owwaId,
        address: user.address,
        role: user.role,
        status: user.status,
        qrCode: user.qrCode,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get current logged-in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      owwaId: user.owwaId,
      address: user.address,
      role: user.role,
      status: user.status,
      qrCode: user.qrCode,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Regenerate QR Code for user
// @route   POST /api/auth/regenerate-qr
// @access  Private
const regenerateQR = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const qrPayload = JSON.stringify({ userId: user._id.toString() });
    const qrCode = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    });
    user.qrCode = qrCode;
    await user.save();
    res.json({ qrCode });
  } catch (error) {
    res.status(500).json({ message: 'Failed to regenerate QR code' });
  }
};

module.exports = { register, login, getMe, regenerateQR };
