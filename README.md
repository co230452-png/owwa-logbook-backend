# OWWA Region 9 Logbook — Backend

Express.js + MongoDB REST API for the OWWA Region 9 Logbook System.

## Tech Stack
- Node.js + Express.js
- MongoDB + Mongoose
- JWT authentication
- bcryptjs for password hashing
- qrcode for QR code generation
- express-validator for input validation

## Folder Structure
```
owwa-logbook-backend/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── authController.js      # Register, login, profile, QR regen
│   ├── userController.js      # Admin: approve/reject/list/delete users
│   └── attendanceController.js# Log + query attendance
├── middleware/
│   └── authMiddleware.js      # JWT protect, adminOnly, approvedOnly
├── models/
│   ├── User.js
│   └── Attendance.js
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   └── attendanceRoutes.js
├── utils/
│   └── seed.js                # Seed script: 1 admin + 5 sample users
├── server.js                  # App entry point
├── .env.example
└── package.json
```

## Setup
See the root-level `SETUP_INSTRUCTIONS.md` for full step-by-step setup including MongoDB Atlas.

Quick start:
```bash
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run seed            # optional: populate sample data
npm run dev              # starts on http://localhost:5000
```

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Register new user (status: pending) |
| POST | `/login` | Public | Login, returns JWT |
| GET | `/me` | Private | Get current user profile |
| POST | `/regenerate-qr` | Private (approved) | Regenerate QR code |

### Users (`/api/users`) — all Admin-only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Dashboard stats |
| GET | `/pending` | List pending registrations |
| GET | `/` | List all users (filters: `status`, `search`) |
| GET | `/:id` | Get single user |
| PATCH | `/:id/status` | Approve/reject (`{ status: 'approved'|'rejected' }`) |
| DELETE | `/:id` | Delete user |

### Attendance (`/api/attendance`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/log` | Admin | Log attendance via scanned `userId` |
| GET | `/` | Admin | All records (filters: `startDate`, `endDate`, `userId`, pagination) |
| GET | `/today` | Admin | Today's attendance summary |
| DELETE | `/:id` | Admin | Delete a record |
| GET | `/my` | Private (approved) | Logged-in user's own attendance |

## Security Notes
- Passwords hashed with bcrypt (12 salt rounds), never returned in API responses.
- JWT required on all protected routes via `Authorization: Bearer <token>` header.
- Input validated with `express-validator` on registration/login.
- Duplicate attendance per user per day prevented via a unique compound MongoDB index (`userId + date`).
- CORS restricted to the configured `FRONTEND_URL`.
