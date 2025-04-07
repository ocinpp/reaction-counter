"use client";

import { useState, useEffect, useRef } from "react";
import { ThumbsUp, ThumbsDown, Maximize2, Minimize2 } from "lucide-react";
import GestureCounter from "@components/gesture-counter";
import ThankYouMessage from "@components/thank-you-message";
import GestureProgressIndicator from "@components/gesture-progress-indicator";

export default function Home() {
  const [thumbsUpCount, setThumbsUpCount] = useState(0);
  const [thumbsDownCount, setThumbsDownCount] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [lastGesture, setLastGesture] = useState<"up" | "down" | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [gestureProgress, setGestureProgress] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<"up" | "down" | null>(
    null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gestureRecognizerRef = useRef<
    import("@mediapipe/tasks-vision").GestureRecognizer | null
  >(null);
  const rafIdRef = useRef<number | null>(null);
  const gestureStartTimeRef = useRef<number | null>(null);
  const lastDetectedGestureRef = useRef<"up" | "down" | null>(null);

  // Gesture validation duration in milliseconds (1 second)
  const GESTURE_VALIDATION_DURATION = 1000;

  useEffect(() => {
    let isMounted = true;

    const loadMediaPipeTasks = async () => {
      try {
        // Import MediaPipe dynamically
        const vision = await import("@mediapipe/tasks-vision");

        // Initialize the face detector
        const { GestureRecognizer, FilesetResolver } = vision;

        if (!isMounted) return;

        // Load the face detection model
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Create a gesture recognizer
        const gestureRecognizer = await GestureRecognizer.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU", // Use GPU delegate for better performance, fallback to CPU if not supported
            },
            runningMode: "VIDEO",
            numHands: 1,
          }
        );

        if (!isMounted) return;

        gestureRecognizerRef.current = gestureRecognizer;
        setModelLoaded(true);

        // Start camera once model is loaded
        await startCamera();
      } catch (error) {
        console.error("Error loading MediaPipe Tasks:", error);
        if (isMounted) {
          setErrorMessage(
            "Failed to load gesture recognition model. Please try again later."
          );
          setIsLoading(false);
        }
      }
    };

    const startCamera = async () => {
      try {
        // Request camera access with the highest possible resolution
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!isMounted) return;

            videoRef.current?.play();

            // Set canvas dimensions once video is loaded
            updateCanvasDimensions();

            // Add resize listener to update canvas dimensions when window size changes
            window.addEventListener("resize", updateCanvasDimensions);

            // Start gesture detection
            detectGestures();
            setIsLoading(false);
          };
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        if (isMounted) {
          setErrorMessage(
            "Could not access camera. Please ensure you have granted camera permissions."
          );
          setIsLoading(false);
        }
      }
    };

    const updateCanvasDimensions = () => {
      if (!canvasRef.current || !videoRef.current || !containerRef.current)
        return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Calculate the scaling factor to fill the container while maintaining aspect ratio
      const scale = Math.max(
        containerWidth / videoWidth,
        containerHeight / videoHeight
      );

      // Set canvas dimensions to fill the container
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // Apply CSS scaling to make it fill the container
      canvasRef.current.style.width = `${videoWidth * scale}px`;
      canvasRef.current.style.height = `${videoHeight * scale}px`;
      canvasRef.current.style.left = `${
        (containerWidth - videoWidth * scale) / 2
      }px`;
      canvasRef.current.style.top = `${
        (containerHeight - videoHeight * scale) / 2
      }px`;

      // Apply the same scaling to the video element
      videoRef.current.style.width = `${videoWidth * scale}px`;
      videoRef.current.style.height = `${videoHeight * scale}px`;
      videoRef.current.style.left = `${
        (containerWidth - videoWidth * scale) / 2
      }px`;
      videoRef.current.style.top = `${
        (containerHeight - videoHeight * scale) / 2
      }px`;
    };

    const detectGestures = () => {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        !gestureRecognizerRef.current
      ) {
        rafIdRef.current = requestAnimationFrame(detectGestures);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        rafIdRef.current = requestAnimationFrame(detectGestures);
        return;
      }

      // Make sure video is playing and has valid dimensions
      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        rafIdRef.current = requestAnimationFrame(detectGestures);
        return;
      }

      try {
        // Get current timestamp for the video frame
        const startTimeMs = performance.now();

        // Draw video frame first (do this every frame regardless of recognition state)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Only process gesture recognition if we're in recognizing state
        if (isRecognizing) {
          // Process the video frame
          const results = gestureRecognizerRef.current.recognizeForVideo(
            video,
            startTimeMs
          );

          // Process results
          if (results.gestures && results.gestures.length > 0) {
            const gesture = results.gestures[0][0].categoryName;

            // Draw hand landmarks if available
            if (results.landmarks) {
              for (const landmarks of results.landmarks) {
                drawLandmarks(ctx, landmarks);
              }
            }

            // Check for thumbs up/down gestures
            let detectedGesture: "up" | "down" | null = null;

            if (gesture === "Thumb_Up") {
              detectedGesture = "up";
            } else if (gesture === "Thumb_Down") {
              detectedGesture = "down";
            }

            // Handle gesture timing
            handleGestureTiming(detectedGesture, startTimeMs);
          } else {
            // No gesture detected
            handleGestureTiming(null, startTimeMs);
          }
        }
      } catch (error) {
        console.error("Error during gesture detection:", error);
      }

      // Continue detection loop
      rafIdRef.current = requestAnimationFrame(detectGestures);
    };

    const handleGestureTiming = (
      detectedGesture: "up" | "down" | null,
      currentTimeMs: number
    ) => {
      // If we're showing the thank you message, don't process gestures
      if (showThankYou) {
        gestureStartTimeRef.current = null;
        lastDetectedGestureRef.current = null;
        setCurrentGesture(null);
        setGestureProgress(0);
        return;
      }

      // If no gesture is detected, reset the timer
      if (detectedGesture === null) {
        gestureStartTimeRef.current = null;
        lastDetectedGestureRef.current = null;
        setCurrentGesture(null);
        setGestureProgress(0);
        return;
      }

      // If this is a new gesture or a different gesture than before, reset the timer
      if (lastDetectedGestureRef.current !== detectedGesture) {
        gestureStartTimeRef.current = currentTimeMs;
        lastDetectedGestureRef.current = detectedGesture;
        setCurrentGesture(detectedGesture);
        setGestureProgress(0);
        return;
      }

      // If we're continuing the same gesture, check if we've reached the threshold
      if (gestureStartTimeRef.current !== null) {
        const elapsedTime = currentTimeMs - gestureStartTimeRef.current;
        const progress = Math.min(elapsedTime / GESTURE_VALIDATION_DURATION, 1);
        setGestureProgress(progress);

        // If we've held the gesture long enough, trigger the action
        if (elapsedTime >= GESTURE_VALIDATION_DURATION && !showThankYou) {
          handleGestureDetected(detectedGesture);
          gestureStartTimeRef.current = null;
          lastDetectedGestureRef.current = null;
          setCurrentGesture(null);
          setGestureProgress(0);
        }
      }
    };

    const drawLandmarks = (
      ctx: CanvasRenderingContext2D,
      landmarks: { x: number; y: number; z: number }[]
    ) => {
      // Define connections between landmarks for drawing
      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4], // thumb
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8], // index finger
        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12], // middle finger
        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16], // ring finger
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20], // pinky
        [0, 5],
        [5, 9],
        [9, 13],
        [13, 17], // palm
      ];

      // Draw connections
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 3;

      for (const [i, j] of connections) {
        if (landmarks[i] && landmarks[j]) {
          ctx.beginPath();
          ctx.moveTo(
            landmarks[i].x * ctx.canvas.width,
            landmarks[i].y * ctx.canvas.height
          );
          ctx.lineTo(
            landmarks[j].x * ctx.canvas.width,
            landmarks[j].y * ctx.canvas.height
          );
          ctx.stroke();
        }
      }

      // Draw landmarks
      ctx.fillStyle = "#FF0000";

      for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(
          point.x * ctx.canvas.width,
          point.y * ctx.canvas.height,
          5,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    };

    const handleGestureDetected = (gesture: "up" | "down") => {
      setLastGesture(gesture);
      setShowThankYou(true);
      setIsRecognizing(false);

      setTimeout(() => {
        if (gesture === "up") {
          setThumbsUpCount((prev) => prev + 1);
        } else {
          setThumbsDownCount((prev) => prev + 1);
        }

        setTimeout(() => {
          setShowThankYou(false);
          setIsRecognizing(true);
        }, 1000);
      }, 1500);
    };

    // Start loading MediaPipe
    loadMediaPipeTasks();

    // Clean up
    return () => {
      isMounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      if (gestureRecognizerRef.current) {
        gestureRecognizerRef.current.close();
      }

      window.removeEventListener("resize", updateCanvasDimensions);
    };
  }, [isRecognizing, showThankYou, GESTURE_VALIDATION_DURATION]);

  // Function to manually trigger gestures (for fallback)
  const triggerGesture = (gesture: "up" | "down") => {
    if (!isRecognizing || showThankYou) return;

    // For manual triggers, we'll simulate the 1-second hold
    setCurrentGesture(gesture);

    // Animate the progress from 0 to 1 over 1 second
    let progress = 0;
    const startTime = performance.now();

    const animateProgress = (timestamp: number) => {
      progress = Math.min(
        (timestamp - startTime) / GESTURE_VALIDATION_DURATION,
        1
      );
      setGestureProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animateProgress);
      } else {
        // Once we reach 1, trigger the gesture
        setCurrentGesture(null);
        setGestureProgress(0);

        setLastGesture(gesture);
        setShowThankYou(true);
        setIsRecognizing(false);

        setTimeout(() => {
          if (gesture === "up") {
            setThumbsUpCount((prev) => prev + 1);
          } else {
            setThumbsDownCount((prev) => prev + 1);
          }

          setTimeout(() => {
            setShowThankYou(false);
            setIsRecognizing(true);
          }, 1000);
        }, 1500);
      }
    };

    requestAnimationFrame(animateProgress);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-black text-white font-geist">
      <div ref={containerRef} className="relative w-full h-dvh overflow-hidden">
        {/* Video and canvas elements */}
        <video
          ref={videoRef}
          className="absolute object-cover"
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="absolute" />

        {/* Counters overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-6 z-50">
          <GestureCounter
            count={thumbsUpCount}
            icon={<ThumbsUp />}
            bgColor="bg-green-600/90"
          />
          <GestureCounter
            count={thumbsDownCount}
            icon={<ThumbsDown />}
            bgColor="bg-red-600/90"
          />
        </div>

        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-60 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>

        {/* Question overlay */}
        {currentGesture === null && isRecognizing && !showThankYou && (
          <div className="absolute inset-0 flex items-center justify-center z-20 m-3">
            <div className="px-4 py-2 bg-black/20 rounded-full text-4xl">
              Let us know how you're feeling!
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {!showThankYou && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 m-3">
            <div className="px-4 py-2 bg-black/50 rounded-full text-sm">
              Show a thumbs up 👍 or thumbs down 👎 gesture for at least{" "}
              {GESTURE_VALIDATION_DURATION / 1000} second
            </div>
          </div>
        )}

        {/* Gesture progress indicator (separate from canvas) */}
        {currentGesture && gestureProgress > 0 && (
          <GestureProgressIndicator
            gesture={currentGesture}
            progress={gestureProgress}
          />
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-100">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-white mb-4"></div>
              <p>
                {modelLoaded
                  ? "Starting camera..."
                  : "Loading gesture recognition model..."}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
            <div className="text-center max-w-md p-4">
              <div className="text-red-500 text-4xl mb-2">⚠️</div>
              <h3 className="text-xl font-bold mb-2">Error</h3>
              <p>{errorMessage}</p>
              <button
                className="mt-4 px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
        )}

        {/* Thank you message */}
        {showThankYou && <ThankYouMessage gesture={lastGesture} />}

        {/* Fallback controls (only shown if there's an error) */}
        {errorMessage && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-4 z-10">
            <button
              className="px-4 py-2 bg-green-600 rounded-full flex items-center gap-2 hover:bg-green-700 transition-colors"
              onClick={() => triggerGesture("up")}
              disabled={
                !isRecognizing || showThankYou || currentGesture !== null
              }
            >
              <ThumbsUp size={16} />
              <span>Simulate Thumbs Up</span>
            </button>
            <button
              className="px-4 py-2 bg-red-600 rounded-full flex items-center gap-2 hover:bg-red-700 transition-colors"
              onClick={() => triggerGesture("down")}
              disabled={
                !isRecognizing || showThankYou || currentGesture !== null
              }
            >
              <ThumbsDown size={16} />
              <span>Simulate Thumbs Down</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
