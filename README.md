# Pin-It - Civic Issue Reporting System

A React-based web application that allows users to report and track civic issues like potholes, trash piles, broken pipes, and street light problems, etc on an interactive map.

## Features

- 🗺️ **Interactive Map**: Click anywhere on the map to report a problem
- 🔄 **Map Toggle**: Switch between OpenStreetMap and Google Maps
- 📍 **Location Services**: Search for locations or use your current location
- 📸 **Image Upload**: Attach up to 5 images per report
- 🔐 **Login / Signup**: Google Sign-In only
- ⭐ **Voting System**: Upvote or downvote (one vote per logged-in user)
- 💬 **Comments**: Add comments (name auto from account)
- 🎨 **Color-Coded Pins**: Different colors for different problem types
- 📊 **Severity Rating**: Rate problems from 1-10

## Tech Stack

### Frontend
- React 18
- React Leaflet (Map integration)
- @react-oauth/google (Google Sign-In)
- Axios (HTTP client)
- React Icons

### Backend
- Node.js
- Express.js
- MongoDB
- Cloudinary (image storage; images compressed to ~1080px / 200–300KB)
- Multer (file upload handling)
- JWT + Google Auth (route protection)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas connection string)

### Setup Steps

1. **Clone or navigate to the project directory**

2. **Install dependencies for all packages:**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables** (see tables below for all options)

   **frontend/.env**

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `REACT_APP_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID (same as backend; see [Google setup](#how-to-set-up-google-sign-in) below) |
   | `REACT_APP_BACKEND_URL` | No | Backend API base URL. Leave empty to use the proxy (localhost:5000 in dev). Set when backend runs elsewhere: `http://localhost:5000`, `http://192.168.1.100:5000`, or `https://api.yoursite.com` |
   | `REACT_APP_GOOGLE_MAPS_API_KEY` | No | From [Google Cloud Console](https://console.cloud.google.com/google/maps-apis). Enable Maps JavaScript API and Places API. OpenStreetMap works without any key. |

   **backend/.env**

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `GOOGLE_CLIENT_ID` | Yes | Same Google OAuth Client ID as frontend (required for auth) |
   | `MONGODB_URI` | Yes* | MongoDB connection string. Default: `mongodb://localhost:27017/pinit`. For Atlas: `mongodb+srv://...` |
   | `JWT_SECRET` | No | Secret for signing JWTs. Omit for dev (default used). **Must** set in production. Use `openssl rand -base64 32` to generate. |
   | `CLOUDINARY_CLOUD_NAME` | Yes | From [Cloudinary Console](https://cloudinary.com/console) |
   | `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
   | `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
   | `CORS_ORIGIN` | No | Comma-separated list of allowed frontend origins. Leave unset to allow all (fine for dev). For production: `https://yoursite.com,https://www.yoursite.com` |
   | `PORT` | No | Server port (default: 5000) |

   \* Required if MongoDB is not running locally on default port.

4. **Start MongoDB** (if running locally):
   ```bash
   # On Windows (if MongoDB is installed as a service, it should start automatically)
   # On Mac/Linux:
   mongod
   ```

5. **Start the development servers:**
   ```bash
   npm run dev
   ```
   
   This will start both:
   - Backend server on `http://localhost:5000`
   - Frontend React app on `http://localhost:3000`

   Or start them separately:
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend
   npm run client
   ```

---

## How to Set Up Google Sign-In

Follow these steps to configure Google OAuth for the Pin-It app.

### Step 1: Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account.
3. Create a new project or select an existing one:
   - Click the project dropdown (top left) → **New Project**
   - Name it (e.g. "PinIt") and click **Create**.

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (unless you use Google Workspace and want internal only), then **Create**.
3. Fill in:
   - **App name**: `Pin-It` (or your app name)
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**.
5. On **Scopes**, click **Add or Remove Scopes** and add:
   - `email`
   - `profile`
   - `openid`
6. Save and continue through the remaining screens.

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Choose **Application type**: **Web application**.
4. **Name**: e.g. `PinIt Web Client`.
5. **Authorized JavaScript origins**:
   - For local dev: `http://localhost:3000`
   - For production: `https://yourdomain.com` (add all domains where the frontend runs)
6. **Authorized redirect URIs** (for Web application type, Google Sign-In often uses JavaScript origins only; add these for compatibility):
   - For local dev: `http://localhost:3000`
   - For production: `https://yourdomain.com`
7. Click **Create**.
8. Copy the **Client ID** (looks like `123456789-abc.apps.googleusercontent.com`).

### Step 4: Add the Client ID to Your App

1. **Frontend** (`frontend/.env`):
   ```
   REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

2. **Backend** (`backend/.env`):
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

   Use the **same** Client ID for both.

### Step 5: Restart Servers

Restart the frontend and backend so the new env vars are loaded:

```bash
# Stop existing processes (Ctrl+C), then:
npm run dev
```

### Step 6: Test Sign-In

1. Open `http://localhost:3000`.
2. Click **Login** or go to `/login`.
3. Click **Continue with Google**.
4. Pick your Google account.
5. You should be redirected back and logged in.

---

## Usage

1. **Open the application** in your browser at `http://localhost:3000`

2. **Sign in with Google** (required to add pins, vote, comment)

3. **Search for a location** using the search bar or click "📍 My Location" to go to your current location

4. **Click on the map** where you want to report a problem

5. **Fill out the form**:
   - Select problem type
   - Set severity (1-10)
   - Optionally add your name and description
   - Upload images (up to 5)

6. **Submit** to create a pin on the map

7. **Click on any pin** to:
   - View full details
   - Upvote or downvote
   - Add comments
   - View images

## API Endpoints

> All `/api/*` routes (except `/api/health` and `/api/auth/*`) require a valid JWT in the `Authorization: Bearer <token>` header.

### Auth
- `POST /api/auth/google` – Exchange Google ID token for JWT and user. Body: `{ "credential": "<google-id-token>" }`. Returns: `{ token, user }`.

### Pins
- `GET /api/pins` - Get all pins
- `GET /api/pins/:id` - Get pin by ID
- `POST /api/pins` - Create a new pin
- `PUT /api/pins/:id` - Update a pin
- `DELETE /api/pins/:id` - Delete a pin

### Comments
- `GET /api/comments/pin/:pinId` - Get all comments for a pin
- `POST /api/comments` - Create a new comment
- `DELETE /api/comments/:id` - Delete a comment

### Votes
- `POST /api/votes` - Vote on a pin
- `GET /api/votes/:pinId/status` - Get the current user's vote status

### Images
- `POST /api/images/upload` - Upload an image (stored on Cloudinary, compressed; returns URL)
- `GET /api/images/:id` - Get image by ID (legacy GridFS only; new pins use Cloudinary URLs)

### Saved pins (UserData)
- `GET /api/pins/saved` - Get saved pin IDs for the current user
- `POST /api/pins/:id/save` - Save a pin for the current user
- `DELETE /api/pins/:id/save` - Unsave a pin for the current user

## Schema

**Pin** (problem reports on the map)
| Field | Type |
|-------|------|
| problemType | String (enum: Trash Pile, Pothole, Broken Pipe, Fuse Street Light, Other) |
| severity | Number (1–10) |
| location | { latitude, longitude, address } |
| images | [String] (Cloudinary URLs) |
| name, description | String |
| upvotes, downvotes | Number |
| votes | [{ userId, voteType }] |
| comments | [ObjectId] ref Comment |
| createdAt, updatedAt | Date |

**Comment**
| Field | Type |
|-------|------|
| pinId | ObjectId ref Pin |
| author | String |
| text | String |
| createdAt | Date |

**UserData** (per-user; one document per user)
| Field | Type |
|-------|------|
| userId | String (unique, Google sub) |
| pinIds | [String] (saved pin IDs) |
| updatedAt | Date |

## Project Structure

```
PinIt/
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Pin.js
│   │   ├── Comment.js
│   │   └── UserData.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── pins.js
│   │   ├── comments.js
│   │   ├── votes.js
│   │   ├── users.js
│   │   └── images.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.js
│   └── package.json
└── package.json
```

## CORS

The backend uses [cors](https://www.npmjs.com/package/cors) to control which frontend origins can call the API.

- **Development** – Leave `CORS_ORIGIN` unset in `backend/.env`. All origins are allowed.
- **Production** – Set `CORS_ORIGIN` to your frontend URL(s) to restrict access:

  ```
  CORS_ORIGIN=https://yoursite.com,https://www.yoursite.com
  ```

  Use comma-separated values for multiple origins. Restart the backend after changing this.

## Notes

- Images are uploaded to **Cloudinary** and only the URL is stored in MongoDB. Images are compressed to max 1080px and ~200–300KB. Old pins may still reference GridFS image IDs; those are served via `GET /api/images/:id`.
- Authentication uses **Google Sign-In** and JWT. The backend verifies the Google ID token and issues a JWT for subsequent API requests.
- The map uses OpenStreetMap tiles by default (free, no API key required)
- Google Maps option available (requires API key - see setup instructions)
- Location search uses Nominatim geocoding service for OpenStreetMap
- Google Maps uses Google Places API for search (when API key is configured)

## License

MIT
