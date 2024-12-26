"use client";

import React, { useState, useRef } from "react";

const VideoRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Refs to manage media recording and video chunks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksQueueRef = useRef<Blob[]>([]); // Queue for video chunks
  const recordingRef = useRef<boolean>(false); // Flag to ensure recording is ongoing
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // Store media stream for later cleanup

  // Start recording
  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream; // Store the stream to close later
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: "video/webm",
        });

        // Capture data chunks as they become available
        mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
          videoChunksQueueRef.current.push(event.data); // Store the chunks
        };

        // When recording stops, handle the stop event
        mediaRecorderRef.current.onstop = handleStopRecording;

        // Start recording in chunks (record every 3 seconds)
        mediaRecorderRef.current.start(3000);
        recordingRef.current = true; // Mark as recording
        setIsRecording(true);
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error);
      });
  };

  // Stop recording and close the camera
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      // Stop all tracks of the stream to close the camera and microphone
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null; // Reset the stream reference
    }

    recordingRef.current = false;
    setIsRecording(false);
  };

  // Handle the recording stop (combine the chunks and create a video URL)
  const handleStopRecording = () => {
    const videoBlob = new Blob(videoChunksQueueRef.current, {
      type: "video/webm",
    });

    // Create a URL for the video and set it in state for playback
    const videoUrl = URL.createObjectURL(videoBlob);
    setVideoUrl(videoUrl);

    // Upload all chunks to the server after recording ends
    uploadChunks(videoChunksQueueRef.current);
  };

  // Retry logic for uploading each chunk
  const uploadChunk = async (chunk: Blob, chunkIndex: number, retries: number = 3) => {
    const formData = new FormData();
    formData.append("videoChunk", chunk, `chunk_${chunkIndex}.webm`);
    formData.append("chunkIndex", chunkIndex.toString()); // Append the chunk index

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        console.log(`Chunk ${chunkIndex} uploaded successfully.`);
      } else {
        throw new Error(`Failed to upload chunk ${chunkIndex}`);
      }
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying chunk ${chunkIndex}, attempts left: ${retries}`);
        await uploadChunk(chunk, chunkIndex, retries - 1); // Retry uploading the chunk
      } else {
        console.error(`Failed to upload chunk ${chunkIndex} after multiple retries:`, error);
      }
    }
  };

  // Upload all chunks sequentially with retry logic
  const uploadChunks = async (chunks: Blob[]) => {
    for (let i = 0; i < chunks.length; i++) {
      await uploadChunk(chunks[i], i); // Upload each chunk with retry logic
    }

    // Once all chunks are uploaded, finalize the video file
    await finalizeVideo();
  };

  // Finalize video by requesting the server to combine the chunks
  const finalizeVideo = async () => {
    try {
      const response = await fetch("http://localhost:3001/finalize", {
        method: "POST",
      });

      if (response.ok) {
        console.log("Video finalized successfully.");
        resetStates(); // Reset all states after successful upload
      } else {
        console.error("Failed to finalize the video");
      }
    } catch (error) {
      console.error("Error finalizing the video:", error);
    }
  };

  // Reset all states to initial values
  const resetStates = () => {
    setVideoUrl("");
    videoChunksQueueRef.current = [];
    mediaRecorderRef.current = null;
    recordingRef.current = false;
  };

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      {videoUrl && <video ref={videoRef} src={videoUrl} controls />}
    </div>
  );
};

export default VideoRecorder;
