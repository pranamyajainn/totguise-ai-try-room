import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Check, X, Sparkles } from 'lucide-react';

interface Capture3DProps {
  onComplete: (images: string[]) => void;
  onCancel: () => void;
}

export const Capture3D: React.FC<Capture3DProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const steps = [
    { label: 'Front', description: 'Face the camera straight on' },
    { label: 'Left Side', description: 'Turn slightly left' },
    { label: 'Right Side', description: 'Turn slightly right' },
  ];

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setError(null);
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Camera access was denied. Please enable camera permissions in your browser settings.");
        } else {
          setError("Could not access your camera. Please ensure it's connected and not being used by another app.");
        }
      }
    }
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Calculate 3:4 crop
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetAspect = 3 / 4;
      
      let drawWidth = video.videoWidth;
      let drawHeight = video.videoHeight;
      let startX = 0;
      let startY = 0;

      if (videoAspect > targetAspect) {
        // Video is wider than 3:4, crop sides
        drawWidth = video.videoHeight * targetAspect;
        startX = (video.videoWidth - drawWidth) / 2;
      } else {
        // Video is taller than 3:4, crop top/bottom
        drawHeight = video.videoWidth / targetAspect;
        startY = (video.videoHeight - drawHeight) / 2;
      }

      canvas.width = drawWidth;
      canvas.height = drawHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the drawing since video is mirrored
        ctx.translate(drawWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, startX, startY, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const newImages = [...capturedImages];
        newImages[step] = dataUrl;
        setCapturedImages(newImages);
        
        if (step < steps.length - 1) {
          setStep(prev => prev + 1);
        } else {
          // All done, set step to 3 to show summary
          setStep(3);
        }
      }
    }
  };

  const handleRetake = (index: number) => {
    setStep(index);
  };

  const handleComplete = () => {
    stream?.getTracks().forEach(track => track.stop());
    onComplete(capturedImages);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-cream md:bg-black/80 flex flex-col items-center justify-center md:p-8">
      <div className="max-w-[480px] w-full h-full md:h-auto md:max-h-[90vh] flex flex-col bg-white md:rounded-2xl md:shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-brand-border/50 bg-white z-20">
          <h2 className="text-lg font-medium text-brand-ink">Take a Photo</h2>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-brand-ink/5 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-brand-cream overflow-y-auto">
          
          {step < 3 ? (
            <>
              {/* Camera Feed */}
              <div className="relative w-full aspect-[3/4] bg-black overflow-hidden flex-shrink-0">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover mirror"
                />

                <AnimatePresence>
                  {showFlash && (
                    <motion.div 
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white z-10"
                    />
                  )}
                </AnimatePresence>

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8 text-center z-20">
                    <div className="max-w-sm">
                      <Camera size={48} className="text-white/50 mx-auto mb-4" />
                      <p className="text-white text-sm mb-6">{error}</p>
                      <button 
                        onClick={() => window.location.reload()}
                        className="bg-white text-black px-6 py-2 rounded-full text-sm font-medium"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Progress Indicator */}
                <div className="absolute top-4 left-0 right-0 flex justify-center z-20">
                  <div className="bg-black/50 text-white px-4 py-1.5 rounded-full text-xs font-medium backdrop-blur-md">
                    Step {step + 1}/3
                  </div>
                </div>

                {/* Overlay Guide */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                  <div className="w-[55%] h-[75%] border-2 border-white/40 border-dashed rounded-[120px] relative" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-brand-ink mb-1">{steps[step].label}</h3>
                  <p className="text-sm text-brand-ink/60">{steps[step].description}</p>
                </div>

                <button 
                  onClick={captureFrame}
                  className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full border border-gray-100 bg-brand-ink/5" />
                </button>
              </div>
            </>
          ) : (
            /* Summary Screen */
            <div className="flex-1 flex flex-col p-6 bg-white">
              <div className="text-center mb-8 mt-4">
                <h3 className="text-xl font-medium text-brand-ink mb-2">Review Photos</h3>
                <p className="text-sm text-brand-ink/60">Make sure your face and body are clearly visible in all angles.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-auto">
                {capturedImages.map((img, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-full aspect-[3/4] rounded-md overflow-hidden border border-brand-border mb-2 relative group">
                      <img src={img} alt={`Angle ${i}`} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-medium text-brand-ink mb-1">{steps[i].label}</p>
                    <button 
                      onClick={() => handleRetake(i)}
                      className="text-[10px] text-brand-ink/60 underline hover:text-brand-ink"
                    >
                      Retake
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <button
                  onClick={handleComplete}
                  className="w-full h-[52px] bg-brand-ink text-brand-cream font-medium rounded-sm flex items-center justify-center gap-2 hover:bg-brand-ink/90 transition-colors"
                >
                  <Check size={18} /> Use These Photos
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};
