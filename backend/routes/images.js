const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const Grid = require('gridfs-stream');

// Initialize GridFS
let gfs;
const conn = mongoose.connection;
let gfsBucket;

conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  
  // Initialize GridFSBucket
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
});

// Use memory storage to avoid compatibility issues
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload image
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Wait for connection to be ready
    if (conn.readyState !== 1) {
      return res.status(503).json({ error: 'Database not ready. Please try again.' });
    }

    // Ensure GridFSBucket is initialized
    if (!gfsBucket) {
      gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
      });
    }

    const filename = `image_${Date.now()}_${req.file.originalname}`;
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname
      }
    });

    // Upload the file buffer
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', () => {
      res.json({ 
        fileId: uploadStream.id.toString(),
        filename: filename 
      });
    });

    uploadStream.on('error', (error) => {
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get image by ID
router.get('/:id', async (req, res) => {
  try {
    // Wait for connection to be ready
    if (conn.readyState !== 1) {
      return res.status(503).json({ error: 'Database not ready. Please try again.' });
    }

    // Ensure GridFSBucket is initialized
    if (!gfsBucket) {
      gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
      });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Get file metadata to determine content type
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const file = files[0];
    // Set content type if available, default to jpeg
    const contentType = file.contentType || file.metadata?.contentType || 'image/jpeg';
    res.set('Content-Type', contentType);
    
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      res.status(404).json({ error: 'Image not found' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
