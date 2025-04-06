"use client";

import { useState, useEffect, useRef } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import GestureCounter from "./components/gesture-counter";
import ThankYouMessage from "./components/thank-you-message";

export default function Home() {
  const [thumbsUpCount, setThumbsUpCount] = useState(0);
  const [thumbsDownCount, setThumbsDownCount] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [lastGesture, setLastGesture] = useState<"up" | "down" | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gestureRecognizerRef = useRef<
    import("@mediapipe/tasks-vision").GestureRecognizer | null
  >(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMediaPipeTasks = async () => {
      try {
        // First, load the FilesetResolver and GestureRecognizer scripts
        // await Promise.all([
        //   loadScript(
        //     "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js"
        //   ),
        //   loadScript(
        //     "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_nosimd_internal.js"
        //   ),
        // ]);

        // Then load the main vision bundle
        // await loadScript(
        //   "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js"
        // );

        // Import MediaPipe dynamically
        const vision = await import("@mediapipe/tasks-vision");

        // Initialize the face detector
        const { GestureRecognizer, FilesetResolver } = vision;

        if (!isMounted) return;

        // Initialize the gesture recognizer
        interface MediaPipeTasks {
          tasks: {
            vision: {
              GestureRecognizer: typeof import("@mediapipe/tasks-vision").GestureRecognizer;
              FilesetResolver: typeof import("@mediapipe/tasks-vision").FilesetResolver;
            };
          };
        }
        // const vision = (window as unknown as MediaPipeTasks).tasks.vision;
        // const GestureRecognizer = vision.GestureRecognizer;
        // const FilesetResolver = vision.FilesetResolver;

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
              delegate: "GPU",
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

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.body.appendChild(script);

        return () => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        };
      });
    };

    const startCamera = async () => {
      try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
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
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;

              // Start gesture detection
              detectGestures();
              setIsLoading(false);
            }
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

    const detectGestures = () => {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        !gestureRecognizerRef.current ||
        !isRecognizing
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

        // Process the video frame
        const results = gestureRecognizerRef.current.recognizeForVideo(
          video,
          startTimeMs
        );

        // Draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Process results
        if (results.gestures && results.gestures.length > 0 && isRecognizing) {
          const gesture = results.gestures[0][0].categoryName;

          // Draw hand landmarks if available
          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              drawLandmarks(ctx, landmarks);
            }
          }

          // Check for thumbs up/down gestures
          if (gesture === "Thumb_Up" && !showThankYou) {
            handleGestureDetected("up");
          } else if (gesture === "Thumb_Down" && !showThankYou) {
            handleGestureDetected("down");
          }
        }
      } catch (error) {
        console.error("Error during gesture detection:", error);
      }

      // Continue detection loop
      rafIdRef.current = requestAnimationFrame(detectGestures);
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
    };
  }, [isRecognizing, showThankYou]);

  // Function to manually trigger gestures (for fallback)
  const triggerGesture = (gesture: "up" | "down") => {
    if (!isRecognizing || showThankYou) return;

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

  return (
    <main className="flex min-h-screen flex-col items-center bg-black text-white font-geist p-4">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center gap-6 mb-8 mt-4">
          <GestureCounter
            count={thumbsUpCount}
            icon={<ThumbsUp />}
            bgColor="bg-green-600"
          />
          <GestureCounter
            count={thumbsDownCount}
            icon={<ThumbsDown />}
            bgColor="bg-red-600"
          />
        </div>

        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
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

          {errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
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

          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {showThankYou && <ThankYouMessage gesture={lastGesture} />}

          {/* Fallback controls (only shown if there's an error) */}
          {errorMessage && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-10">
              <button
                className="px-4 py-2 bg-green-600 rounded-full flex items-center gap-2 hover:bg-green-700 transition-colors"
                onClick={() => triggerGesture("up")}
                disabled={!isRecognizing || showThankYou}
              >
                <ThumbsUp size={16} />
                <span>Simulate Thumbs Up</span>
              </button>
              <button
                className="px-4 py-2 bg-red-600 rounded-full flex items-center gap-2 hover:bg-red-700 transition-colors"
                onClick={() => triggerGesture("down")}
                disabled={!isRecognizing || showThankYou}
              >
                <ThumbsDown size={16} />
                <span>Simulate Thumbs Down</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-center mt-4 text-gray-400">
          Show a thumbs up 👍 or thumbs down 👎 gesture to the camera
        </p>

        {/* Instructions only shown if there's an error */}
        {errorMessage && (
          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Instructions</h2>
            <p className="text-gray-400">
              Since gesture recognition couldn't be loaded, you can use the
              buttons above to simulate gestures.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
