const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const Grid = require('gridfs-stream');

// Configure Cloudinary (must be set before uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize GridFS for backward compatibility with old image IDs
let gfs;
const conn = mongoose.connection;
let gfsBucket;

conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Eager transformation: max dimension 1080px, quality ~200–300KB
const COMPRESS_EAGER = [
  {
    width: 1080,
    height: 1080,
    crop: 'limit',
    quality: 'auto:good',
    fetch_format: 'auto'
  }
];

// Upload image to Cloudinary (compressed), return URL only
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ error: 'Image upload not configured. Set CLOUDINARY_* in .env.' });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'image',
      folder: 'pinit',
      eager: COMPRESS_EAGER,
      eager_async: false
    });

    // Use eager (compressed) URL if available, otherwise default secure_url
    const imageUrl = result.eager && result.eager[0] && result.eager[0].secure_url
      ? result.eager[0].secure_url
      : result.secure_url;

    res.json({
      url: imageUrl,
      fileId: result.public_id
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: error.message || 'Image upload failed' });
  }
});

// Backward compatibility: serve old GridFS images by ID (24-char hex ObjectId)
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const isMongoId = /^[a-fA-F0-9]{24}$/.test(id);

  if (!isMongoId) {
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    if (conn.readyState !== 1) {
      return res.status(503).json({ error: 'Database not ready. Please try again.' });
    }

    if (!gfsBucket) {
      gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
      });
    }

    const fileId = new mongoose.Types.ObjectId(id);
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const file = files[0];
    const contentType = file.contentType || file.metadata?.contentType || 'image/jpeg';
    res.set('Content-Type', contentType);
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', () => {
      res.status(404).json({ error: 'Image not found' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
