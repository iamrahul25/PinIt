# Pin-It - Civic Issue Reporting System

A React-based web application that allows users to report and track civic issues like potholes, trash piles, broken pipes, and street light problems, etc on an interactive map.

## Features

- 🗺️ **Interactive Map**: Click anywhere on the map to report a problem
- 🔄 **Map Toggle**: Switch between OpenStreetMap and Google Maps
- 📍 **Location Services**: Search for locations or use your current location
- 📸 **Image Upload**: Attach up to 5 images per report
- ⭐ **Voting System**: Upvote or downvote reported issues
- 💬 **Comments**: Add comments to discuss issues
- 🎨 **Color-Coded Pins**: Different colors for different problem types
- 📊 **Severity Rating**: Rate problems from 1-10

## Tech Stack

### Frontend
- React 18
- React Leaflet (Map integration)
- Axios (HTTP client)
- React Icons

### Backend
- Node.js
- Express.js
- MongoDB
- Cloudinary (image storage; images compressed to ~1080px / 200–300KB)
- Multer (file upload handling)

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
   - Create `backend/.env` with:
     - `MONGODB_URI` – MongoDB connection string (default: `mongodb://localhost:27017/pinit`)
     - **Cloudinary** (required for image uploads): get from https://cloudinary.com/console
       - `CLOUDINARY_CLOUD_NAME`
       - `CLOUDINARY_API_KEY`
       - `CLOUDINARY_API_SECRET`
   - Create `frontend/.env` file and add your Google Maps API key (optional, for Google Maps toggle):
     ```
     REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     ```
     - Get your API key from: https://console.cloud.google.com/google/maps-apis
     - Enable the following APIs: Maps JavaScript API and Places API
     - Note: OpenStreetMap works without any API key

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
- `GET /api/votes/:pinId/:userId` - Get vote status for a user

### Images
- `POST /api/images/upload` - Upload an image (stored on Cloudinary, compressed; returns URL)
- `GET /api/images/:id` - Get image by ID (legacy GridFS only; new pins use Cloudinary URLs)

## Project Structure

```
PinIt/
├── backend/
│   ├── models/
│   │   ├── Pin.js
│   │   └── Comment.js
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
- User identification is handled via localStorage (for demo purposes)
- In production, implement proper authentication
- The map uses OpenStreetMap tiles by default (free, no API key required)
- Google Maps option available (requires API key - see setup instructions)
- Location search uses Nominatim geocoding service for OpenStreetMap
- Google Maps uses Google Places API for search (when API key is configured)

## License

MIT
