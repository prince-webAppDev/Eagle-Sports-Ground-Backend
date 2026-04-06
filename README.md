# Cricket Management Backend

A complete Node.js/Express REST API for managing cricket events, teams, players, and match scorecards. Features two-factor admin authentication, automated career statistics, Cloudinary media uploads, and refresh token rotation.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | MongoDB (Mongoose 8) |
| Media | Cloudinary |
| Auth | JWT (access + refresh) + Nodemailer OTP |
| Security | Helmet, CORS, express-rate-limit |

---

## Project Structure

```
src/
├── config/
│   ├── db.js                 # MongoDB connection
│   └── cloudinary.js         # Cloudinary SDK config
├── controllers/
│   ├── auth.controller.js    # Login, OTP, refresh, logout
│   ├── team.controller.js    # CRUD + cascading delete
│   ├── player.controller.js  # CRUD + image upload
│   ├── match.controller.js   # Fixture creation + finalize
│   └── public.controller.js  # Public-facing read endpoints
├── middlewares/
│   ├── auth.middleware.js        # JWT Bearer guard (protect)
│   ├── upload.middleware.js      # Multer memory storage
│   ├── rateLimiter.middleware.js # express-rate-limit configs
│   └── errorHandler.middleware.js# Global error handler
├── models/
│   ├── Admin.model.js        # Admin + OTP + refresh token storage
│   ├── Team.model.js         # Team + cascading delete hook
│   ├── Player.model.js       # Player + virtual stat fields
│   └── Match.model.js        # Match + embedded scorecard
├── routes/
│   ├── auth.routes.js
│   ├── team.routes.js
│   ├── player.routes.js
│   ├── match.routes.js
│   └── public.routes.js
├── services/
│   ├── email.service.js      # Nodemailer OTP sender
│   ├── stats.service.js      # Career stat automation (bulkWrite)
│   └── cloudinary.service.js # Upload/delete via stream
├── utils/
│   ├── ApiError.js           # Operational error class
│   ├── ApiResponse.js        # Consistent success wrapper
│   ├── asyncHandler.js       # Async route wrapper
│   ├── generateOtp.js        # crypto.randomInt OTP
│   ├── jwt.js                # Sign/verify access + refresh tokens
│   └── seedAdmin.js          # One-time admin creation script
├── app.js                    # Express app + middleware + routes
└── server.js                 # Entry point: DB connect + listen
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values in .env
```

**Required variables:**

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | Strong random string (≥64 chars) |
| `REFRESH_TOKEN_SECRET` | Different strong random string (≥64 chars) |
| `ADMIN_EMAIL` | Email address where OTPs are delivered |
| `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS` | SMTP credentials (Gmail App Password recommended) |
| `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET` | Cloudinary project credentials |

### 3. Seed the admin account (run once)

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=YourStrongPassword123! node src/utils/seedAdmin.js
```

### 4. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

---

## Authentication Flow

```
1. POST /api/auth/login         { username, password }
         → validates credentials, sends 6-digit OTP to ADMIN_EMAIL

2. POST /api/auth/verify-otp    { username, otp }
         → validates OTP (10 min window)
         → returns: { accessToken } in body  +  refreshToken in HTTP-Only cookie

3. All protected requests:
         Authorization: Bearer <accessToken>

4. POST /api/auth/refresh       (cookie sent automatically)
         → rotates refresh token (old one is invalidated)
         → returns new accessToken
         → reuse of a revoked token → ALL sessions wiped (breach detection)

5. POST /api/auth/logout
         → clears cookie, removes token from DB
```

---

## API Reference

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | Public | Step 1: credentials → OTP email |
| POST | `/verify-otp` | Public | Step 2: OTP → tokens |
| POST | `/refresh` | Cookie | Rotate refresh token |
| POST | `/logout` | Cookie | Invalidate session |

---

### Teams — `/api/teams` (Protected)

| Method | Path | Body / Form | Description |
|---|---|---|---|
| GET | `/` | — | List all teams |
| POST | `/` | `name`, `logo` (file) | Create team |
| GET | `/:id` | — | Get team by ID |
| PATCH | `/:id` | `name?`, `logo?` (file) | Update team |
| DELETE | `/:id` | — | Delete team + cascade players |

Upload field name: `logo`

---

### Players — `/api/players` (Protected)

| Method | Path | Body / Form | Description |
|---|---|---|---|
| GET | `/` | `?team_id=` | List players (filterable) |
| POST | `/` | `team_id`, `name`, `position`, `image` (file) | Create player |
| GET | `/:id` | — | Get player by ID |
| PATCH | `/:id` | any field + `image?` (file) | Update player |
| DELETE | `/:id` | — | Delete player |

Valid `position` values: `Batsman`, `Bowler`, `All-Rounder`, `Wicket-Keeper`

Upload field name: `image`

---

### Matches — `/api/matches` (Protected)

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/` | — | List all matches |
| POST | `/` | `team_a_id`, `team_b_id`, `date`, `ground` | Create fixture |
| GET | `/:id` | — | Get match details |
| PATCH | `/:id/finalize` | `innings[]`, `individual_performances[]` | Finalize + update stats |
| DELETE | `/:id` | — | Delete match |

#### Finalize match body example

```json
{
  "innings": [
    { "team_id": "<ObjectId>", "runs": 185, "wickets": 6, "overs": 20 },
    { "team_id": "<ObjectId>", "runs": 172, "wickets": 10, "overs": 19.3 }
  ],
  "individual_performances": [
    {
      "player_id": "<ObjectId>",
      "runs_scored": 67,
      "balls_faced": 42,
      "fours": 6,
      "sixes": 3,
      "wickets_taken": 0,
      "overs_bowled": 0,
      "runs_conceded": 0,
      "was_dismissed": true
    },
    {
      "player_id": "<ObjectId>",
      "runs_scored": 5,
      "balls_faced": 8,
      "fours": 0,
      "sixes": 0,
      "wickets_taken": 3,
      "overs_bowled": 4,
      "runs_conceded": 28,
      "was_dismissed": false
    }
  ]
}
```

---

### Public — `/api/public` (No auth)

| Method | Path | Query | Description |
|---|---|---|---|
| GET | `/matches` | `?status=Upcoming\|Completed` | All matches |
| GET | `/match/:id` | — | Full scorecard (completed) |
| GET | `/leaderboard` | — | Top 10 batsmen + top 10 bowlers |

---

## Automated Statistics

When `PATCH /api/matches/:id/finalize` is called:

1. The match scorecard is saved with all innings and individual performances.
2. `stats.service.js` runs a single MongoDB `bulkWrite` — one `$inc` update per player.
3. Career totals (`total_runs`, `total_balls_faced`, `total_wickets_taken`, `total_overs_bowled`, `matches_played`, etc.) are updated atomically.
4. Virtual fields (`strike_rate`, `batting_avg`, `bowling_avg`) are computed from these totals on every read — no extra storage needed.

---

## Cascading Deletes

Deleting a Team via `DELETE /api/teams/:id`:

1. Team logo is removed from Cloudinary.
2. Mongoose `pre('findOneAndDelete')` hook fires.
3. All `Player` documents with matching `team_id` are deleted.
4. Player images are **not** individually removed from Cloudinary in the cascade (to avoid N Cloudinary API calls). If this matters for your use case, add individual player deletion calls inside the hook or run a scheduled cleanup.

---

## Security Notes

- Passwords are hashed with **bcrypt (cost factor 12)**.
- Refresh tokens are **hashed before storage** — plaintext is never saved.
- Refresh token **reuse detection**: if a revoked token is presented, all sessions for that admin are immediately invalidated.
- OTP is generated with `crypto.randomInt` (no modulo bias).
- Rate limiting: 10 req/15 min on auth routes, 100 req/15 min on API routes.
- Helmet sets secure HTTP headers on every response.
- `password_hash`, `otp_secret`, `otp_expiry`, and `refresh_tokens` are excluded from all queries by default (`select: false`).
