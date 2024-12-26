import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());

// Set up disk storage for multer to save the chunks in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// A map to store video chunks by their chunk index
let videoChunks: { [key: number]: Buffer } = {};
let totalChunks = 0; // Keep track of the total number of chunks expected

app.post('/upload', upload.single('videoChunk'), (req: any, res: any) => {
  // simulate failed
  // const shouldFail = Math.random() < 0.5; 
  // if (shouldFail) {
  //   return res.status(500).send('Upload failed');
  // } 
    if (!req.file || !req.body.chunkIndex) {
    return res.status(400).send('Missing file or chunk index');
  }

  const chunkIndex = parseInt(req.body.chunkIndex);
  const chunkData = req.file.buffer;

  // Store the chunk in the correct index
  videoChunks[chunkIndex] = chunkData;

  // Increment the total number of chunks
  if (chunkIndex + 1 > totalChunks) {
    totalChunks = chunkIndex + 1; // Update totalChunks to the latest chunk index
  }

  console.log(`Received chunk ${chunkIndex}`);

  // Respond when the chunk is successfully received
  res.status(200).send(`Chunk ${chunkIndex} uploaded successfully`);
});

// Endpoint to merge chunks and finalize the video file
app.post('/finalize', (req: any, res: any) => {
  // Check if all chunks have been received
  if (Object.keys(videoChunks).length !== totalChunks) {
    return res.status(400).send('Not all chunks have been uploaded');
  }

  const finalVideoPath = path.join(__dirname, 'uploads', 'final_video.webm');
  const writeStream = fs.createWriteStream(finalVideoPath);

  // Write all chunks to the final file in the correct order
  for (let i = 0; i < totalChunks; i++) {
    if (videoChunks[i]) {
      writeStream.write(videoChunks[i]);
      console.log(`Writing chunk ${i}`);
    } else {
      return res.status(400).send(`Missing chunk ${i}`);
    }
  }

  writeStream.end();

  writeStream.on('finish', () => {
    console.log('Final video file saved');
    // Clear video chunks after saving the video
    videoChunks = {};
    totalChunks = 0;
    res.status(200).send('Video file saved successfully');
  });

  writeStream.on('error', (err) => {
    console.error('Error saving video:', err);
    res.status(500).send('Error saving video file');
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
