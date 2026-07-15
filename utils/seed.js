require('dotenv').config();
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const connectDB = require('../config/db');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

const seed = async () => {
  await connectDB();
  try {
    await User.deleteMany({});
    await Attendance.deleteMany({});
    console.log('🗑️  Cleared existing data');

    const admin = await User.create({
      firstName: 'OWWA', lastName: 'Administrator',
      email: 'admin@owwa9.gov.ph', phone: '09171234567',
      owwaId: 'ADMIN-001', address: 'OWWA Region 9 Office, Zamboanga City',
      password: 'Admin@1234', role: 'admin', status: 'approved',
    });
    console.log(`✅ Admin: ${admin.email} / Admin@1234`);

    const sampleUsers = [
      { firstName: 'Maria',  lastName: 'Santos',    email: 'maria.santos@email.com',   phone: '09181234567', owwaId: 'OWWA-2024-001', address: 'Zamboanga City',    password: 'User@1234', status: 'approved' },
      { firstName: 'Juan',   lastName: 'Dela Cruz', email: 'juan.delacruz@email.com',  phone: '09191234567', owwaId: 'OWWA-2024-002', address: 'Pagadian City',    password: 'User@1234', status: 'approved' },
      { firstName: 'Ana',    lastName: 'Reyes',     email: 'ana.reyes@email.com',      phone: '09201234567', owwaId: 'OWWA-2024-003', address: 'Dipolog City',     password: 'User@1234', status: 'approved' },
      { firstName: 'Pedro',  lastName: 'Garcia',    email: 'pedro.garcia@email.com',   phone: '09211234567', owwaId: '',              address: 'Dapitan City',    password: 'User@1234', status: 'pending'  },
      { firstName: 'Rosa',   lastName: 'Lim',       email: 'rosa.lim@email.com',       phone: '09221234567', owwaId: '',              address: 'Zamboanga Norte', password: 'User@1234', status: 'pending'  },
    ];

    const createdUsers = [];
    for (const u of sampleUsers) {
      const user = await User.create(u);
      if (user.status === 'approved') {
        const qrPayload = JSON.stringify({ userId: user._id.toString() });
        user.qrCode = await QRCode.toDataURL(qrPayload, { width: 300, margin: 2, color: { dark: '#1e3a8a', light: '#ffffff' } });
        await user.save();
      }
      createdUsers.push(user);
      console.log(`✅ User: ${user.email} (${user.status})`);
    }

    // Sample attendance for last 5 weekdays with morning/afternoon slots
    const approvedUsers = createdUsers.filter(u => u.status === 'approved');
    const today = new Date();
    let daysAdded = 0, checked = 0;
    while (daysAdded < 5) {
      checked++;
      const d = new Date(today);
      d.setDate(d.getDate() - checked);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const dateStr = d.toISOString().split('T')[0];

      for (const user of approvedUsers) {
        if (Math.random() < 0.15) continue; // 15% absent
        const mIn  = new Date(d); mIn.setHours(8,  Math.floor(Math.random()*20), 0);
        const mOut = new Date(d); mOut.setHours(12, Math.floor(Math.random()*30), 0);
        const aIn  = new Date(d); aIn.setHours(13, Math.floor(Math.random()*20), 0);
        const aOut = new Date(d); aOut.setHours(17, Math.floor(Math.random()*30), 0);

        const mMins = Math.round((mOut - mIn) / 60000);
        const aMins = Math.round((aOut - aIn) / 60000);

        try {
          await Attendance.create({
            userId: user._id, date: dateStr, scannedBy: admin._id,
            morningIn: mIn, morningOut: mOut,
            afternoonIn: aIn, afternoonOut: aOut,
            totalMinutes: mMins + aMins,
          });
        } catch (_) {}
      }
      daysAdded++;
    }
    console.log('✅ Sample attendance created');

    console.log('\n🎉 Seed complete!');
    console.log('  Admin:  admin@owwa9.gov.ph / Admin@1234');
    console.log('  User:   maria.santos@email.com / User@1234\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
