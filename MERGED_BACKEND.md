# Merged Backend Design — Single ngrok Server

## TL;DR

**Yes, it works — and it's cleaner than two servers.**

Both backends already share the same MongoDB database (`gtrash`). Their schemas are identical (Schedule, Report, Fleet, Truck, Route). The only real differences are:
- GarbageTruck backend: public routes + Socket.io server (the "source of truth" for live tracking)
- Officials backend: auth-protected routes + a Socket.io **relay client** that connects back to the GarbageTruck server

When merged into one server, the relay disappears entirely — the Officials dashboard and Resident app both connect to the same Socket.io instance.

---

## Current Architecture (problem)

```
GarbageTruck App  →  port 5000  (GarbageTruck backend)
Resident App      →  port 5000  (same)
Officials Web     →  port 4000  (Officials backend)
                         └──relay──▶ port 5000 (socket client to forward truck events)
```

ngrok can only tunnel **one port at a time** on the free plan.

---

## Merged Architecture (solution)

```
GarbageTruck App  ──┐
Resident App      ──┼──▶  port 5000  (Merged backend)  ◀──  Officials Web
                   ─┘         │
                           MongoDB (gtrash)
```

Single ngrok tunnel → `https://xxxx.ngrok-free.app` → port 5000.

---

## What Gets Simplified

| Before | After |
|--------|-------|
| Two `app.js` files | One `app.js` |
| Two MongoDB connections | One connection |
| Duplicate schemas (Schedule, Report, etc.) | Defined once |
| Socket relay client in Officials backend | Deleted — one `io` instance serves everyone |
| Two servers to start | `node app.js` |
| Two ngrok tunnels needed | One tunnel |

---

## Route Conflict Strategy

Several routes exist in both backends but with different auth levels. The fix is an **optional auth middleware**:

```js
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try { req.official = jwt.verify(header.slice(7), JWT_SECRET); }
    catch (_) { /* invalid token — treat as public */ }
  }
  next();
}
```

Routes that previously conflicted now use one handler that does the right thing based on whether a token is present:

```js
// Works for both Resident app (no auth) and Officials dashboard (auth + barangay filter)
app.get('/api/reports', optionalAuth, async (req, res) => {
  const filter = req.official ? barangayFilter(req.official) : {};
  res.json(await Report.find(filter).sort({ createdAt: -1 }));
});
```

---

## Full Merged Route Table

### Public (no auth)
| Method | Path | Used by |
|--------|------|---------|
| GET | `/ping` | health check |
| GET | `/api/trucks` | Resident app, Officials (fallback) |
| GET | `/api/trucks/:truckId` | GarbageTruck app |
| POST | `/api/trucks/location` | GarbageTruck app (GPS updates) |
| POST | `/api/reports` | Resident app (submit report) |
| GET | `/api/schedules/today` | Resident HomeScreen |
| GET | `/api/schedules/truck/:truckId/today` | GarbageTruck app |
| GET | `/api/routes/truck/:truckId` | GarbageTruck app |
| POST | `/api/auth/login` | Officials web dashboard |
| POST | `/api/auth/seed` | dev only |

### Optional auth (public if no token, filtered if token present)
| Method | Path | Behavior |
|--------|------|---------|
| GET | `/api/reports` | No auth → all reports; Auth → barangay filtered |
| GET | `/api/routes` | No auth → all routes; Auth → barangay filtered |
| GET | `/api/fleet` | No auth → all fleet; Auth → barangay filtered |
| GET | `/api/schedules` | No auth → by `?month=`; Auth → same + barangay |

### Requires auth (Officials only)
| Method | Path | Action |
|--------|------|--------|
| GET | `/api/auth/me` | verify token |
| GET | `/api/stats` | dashboard stats |
| POST | `/api/fleet` | register new truck |
| PATCH | `/api/fleet/:truckId` | update driver/route |
| DELETE | `/api/fleet/:truckId` | remove truck |
| PATCH | `/api/reports/:id` | update report status |
| DELETE | `/api/reports/:id` | delete report |
| POST | `/api/routes` | create route |
| PATCH | `/api/routes/:id` | update route / assign truck |
| DELETE | `/api/routes/:id` | delete route |
| POST | `/api/schedules` | create schedule |
| DELETE | `/api/schedules/:id` | delete schedule |
| GET | `/api/trucks` | (optional: same as public, or add auth check) |
| GET | `/api/collections/truck/:truckId` | collection history |
| POST | `/api/collections` | log a collection |

---

## Socket.io Events (unchanged, one server now)

| Event | Direction | Description |
|-------|-----------|-------------|
| `truck:location` | GarbageTruck App → Server | Driver sends GPS |
| `truck:location:update` | Server → Everyone | Broadcast position |
| `truck:offline` | GarbageTruck App → Server | Driver goes offline |
| `report:new` | Server → Everyone | New report submitted |
| `report:updated` | Server → Everyone | Report status changed |
| `fleet:new/updated/deleted` | Server → Officials | Fleet changes |
| `route:new/updated` | Server → Everyone | Route changes |
| `schedule:changed` | Server → Everyone | Schedule updated |
| `collection:new` | Server → Everyone | Stop completed |

> **Key change:** `trackingRelay?.emit('schedule:changed', ...)` in the old Officials backend becomes just `io.emit('schedule:changed', ...)` — no relay needed.

---

## Environment Variables (merged `.env`)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gtrash
JWT_SECRET=gtrash-officials-secret-2025
```

The `TRACKING_URL` variable is no longer needed.

---

## Client Changes After Merging

### Resident App — `src/config.js`
```js
// Before
const API_URL = 'http://192.168.x.x:5000';

// After
const API_URL = 'https://xxxx.ngrok-free.app';
```

### GarbageTruck App — `src/config.js` (or wherever API_URL is defined)
```js
const API_URL = 'https://xxxx.ngrok-free.app';
```

### Officials Web — `src/api.js` or axios base URL
```js
// Before
axios.defaults.baseURL = 'http://localhost:4000';

// After
axios.defaults.baseURL = 'https://xxxx.ngrok-free.app';
```

> Every time you restart ngrok you get a new URL (on the free plan). Update all three config files with the new URL and rebuild/reload.

---

## Implementation Steps

1. **Create `backend/app.js`** at the project root (or `Get-Trash/backend/app.js`)
   - Copy GarbageTruck `app.js` as the base (it's the Socket.io server)
   - Add `bcrypt`, `jsonwebtoken` dependencies (from Officials backend)
   - Add `Official` schema and all auth routes
   - Add `optionalAuth` middleware
   - Add all Officials-only protected routes
   - Add `GET /api/stats`
   - Remove `const { io: connectTracking }` and all relay code
   - Replace `trackingRelay?.emit(...)` with `io.emit(...)` in schedule/route handlers

2. **Install missing deps** in the new backend folder:
   ```
   npm install bcryptjs jsonwebtoken
   ```

3. **Update the three client config files** with the ngrok URL

4. **Start the merged server:**
   ```
   node app.js
   ```

5. **Start ngrok:**
   ```
   ngrok http 5000
   ```

---

## Will It Actually Work?

Yes. The reason is that both backends were already writing to and reading from the **same MongoDB database**. There was never actually two separate data stores — just two Express processes on top of one DB. Merging them is straightforward and removes the fragile socket relay in the process.

The only complexity is the optional auth pattern for shared GET routes, and that's ~10 lines of code.
