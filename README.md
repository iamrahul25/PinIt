# Pin-It - Civic Issue Reporting System

A React-based web application that allows users to report and track civic issues like potholes, trash piles, broken pipes, and street light problems, etc on an interactive map.

## Features

- 🗺️ **Interactive Map**: Click anywhere on the map to report a problem
- 🔄 **Map Toggle**: Switch between OpenStreetMap and Google Maps
- 📍 **Location Services**: Search for locations or use your current location
- 📸 **Image Upload**: Attach up to 5 images per report
- 🔐 **Login / Signup**: Clerk Authentication (Google, Apple, Microsoft only)
- ⭐ **Voting System**: Upvote or downvote (one vote per logged-in user)
- 💬 **Comments**: Add comments (name auto from account)
- 🎨 **Color-Coded Pins**: Different colors for different problem types
- 📊 **Severity Rating**: Rate problems from 1-10

## Tech Stack

### Frontend
- React 18
- React Leaflet (Map integration)
- Clerk React SDK (Authentication)
- Axios (HTTP client)
- React Icons

### Backend
- Node.js
- Express.js
- MongoDB
- Cloudinary (image storage; images compressed to ~1080px / 200–300KB)
- Multer (file upload handling)
- Clerk Express middleware (route protection)

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

3. **Set up environment variables:**
   - **frontend/.env**
     - `REACT_APP_CLERK_PUBLISHABLE_KEY` – Clerk publishable key (required for login/signup)
     - `REACT_APP_BACKEND_URL` (optional) – leave empty or unset to use the package.json proxy (localhost:5000 in dev). Set to a full URL (e.g. `http://192.168.1.100:5000`) to point to a different backend.
     - `REACT_APP_GOOGLE_MAPS_API_KEY` (optional) – from https://console.cloud.google.com/google/maps-apis (enable Maps JavaScript API and Places API). OpenStreetMap works without any API key.
   - **backend/.env**
     - `MONGODB_URI` – MongoDB connection string (default: `mongodb://localhost:27017/pinit`)
     - **Cloudinary** (required for image uploads): get from https://cloudinary.com/console
       - `CLOUDINARY_CLOUD_NAME`
       - `CLOUDINARY_API_KEY`
       - `CLOUDINARY_API_SECRET`
     - **Clerk** (required for authentication & backend protection)
       - `CLERK_SECRET_KEY`
       - `CLERK_PUBLISHABLE_KEY`

   **Where to get Clerk keys and how to set them up:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com).
   - Sign up or log in, then create an **Application** (or select an existing one).
   - In the left sidebar, go to **API Keys**.
   - You will see:
     - **Publishable key** (`pk_...`) – use in `frontend/.env` as `REACT_APP_CLERK_PUBLISHABLE_KEY` and in `backend/.env` as `CLERK_PUBLISHABLE_KEY`
     - **Secret key** (`sk_...`) – click “Show” and use in `backend/.env` as `CLERK_SECRET_KEY` only (never in the frontend)
   - **Important:** Never commit `.env` files or expose the secret key in the frontend. The publishable key is safe to use in the React app; the secret key must only live in the backend.
   - **OAuth (Google/Apple/Microsoft):** In the Clerk Dashboard, go to **Paths** or **Redirect URLs** and ensure your app’s OAuth callback is allowed. For local dev, add `http://localhost:3000/sso-callback` (or your frontend origin + `/sso-callback`) so “Continue with Google” etc. can redirect back correctly.
   - After changing `.env`, restart the frontend (`npm start`) and backend server so the new values are loaded.
   - **Console warning:** When using development keys (`pk_test_...`), Clerk shows a warning in the browser console. This is expected for local testing and cannot be disabled; use production keys in production to avoid it.

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

## Usage

1. **Open the application** in your browser at `http://localhost:3000`

2. **Search for a location** using the search bar or click "📍 My Location" to go to your current location

3. **Click on the map** where you want to report a problem

4. **Fill out the form**:
   - Select problem type
   - Set severity (1-10)
   - Optionally add your name and description
   - Upload images (up to 5)

5. **Submit** to create a pin on the map

6. **Click on any pin** to:
   - View full details
   - Upvote or downvote
   - Add comments
   - View images

## API Endpoints

> All `/api/*` routes (except `/api/health`) require a valid Clerk session token in the `Authorization: Bearer <token>` header.

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
| userId | String (unique) |
| pinIds | [String] (saved pin IDs) |
| updatedAt | Date |

## Project Structure

```
PinIt/
├── backend/
│   ├── models/
│   │   ├── Pin.js
│   │   ├── Comment.js
│   │   └── UserData.js
│   ├── routes/
│   │   ├── pins.js
│   │   ├── comments.js
│   │   ├── votes.js
│   │   └── images.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapView.js
│   │   │   ├── PinForm.js
│   │   │   └── PinDetails.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── package.json
```

## Notes

- Images are uploaded to **Cloudinary** and only the URL is stored in MongoDB. Images are compressed to max 1080px and ~200–300KB. Old pins may still reference GridFS image IDs; those are served via `GET /api/images/:id`.
- Authentication is handled by Clerk; enable Google/Apple/Microsoft providers in your Clerk dashboard.
- The backend validates every request with `@clerk/express` to ensure routes are protected by the same identity provider.
- The map uses OpenStreetMap tiles by default (free, no API key required)
- Google Maps option available (requires API key - see setup instructions)
- Location search uses Nominatim geocoding service for OpenStreetMap
- Google Maps uses Google Places API for search (when API key is configured)

## License

MIT
