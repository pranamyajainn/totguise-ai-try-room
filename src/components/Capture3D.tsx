import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Check, X, RotateCw, User, Sparkles } from 'lucide-react';

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
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const steps = [
    { label: 'Front View', description: 'Look straight into the camera' },
    { label: 'Left Profile', description: 'Turn your head to the left' },
    { label: 'Right Profile', description: 'Turn your head to the right' },
    { label: 'Looking Up', description: 'Tilt your head slightly up' },
    { label: 'Looking Down', description: 'Tilt your head slightly down' },
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
          setError("Camera access was denied. Please enable camera permissions in your browser settings to use 3D capture.");
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => [...prev, dataUrl]);
        
        if (step < steps.length - 1) {
          setStep(prev => prev + 1);
        } else {
          setIsCapturing(false);
        }
      }
    }
  };

  const handleComplete = () => {
    stream?.getTracks().forEach(track => track.stop());
    onComplete(capturedImages);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-ink flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-4xl w-full h-full flex flex-col gap-6">
        <div className="flex justify-between items-center text-brand-cream">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif">3D Facial Capture</h2>
            <p className="text-sm opacity-60">Follow the guide to build your precise 3D structure</p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8 text-center">
              <div className="max-w-sm">
                <Camera size={48} className="text-brand-error mx-auto mb-4 opacity-50" />
                <p className="text-brand-cream text-lg mb-6">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="btn-primary px-8 py-3"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
          
          {/* Overlay Guide */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-64 h-80 md:w-80 md:h-96 border-2 border-brand-cream/30 rounded-[100px] relative">
              <div className="absolute inset-0 border-2 border-brand-cream/10 rounded-[100px] scale-110" />
              <div className="absolute inset-0 border-2 border-brand-cream/5 rounded-[100px] scale-120" />
              
              {/* Step Indicator */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-max">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-brand-cream text-brand-ink px-6 py-2 rounded-full font-bold text-sm shadow-xl flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    {steps[step].label}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="absolute top-6 left-6 right-6 flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i < capturedImages.length ? 'bg-brand-cream' : 
                  i === capturedImages.length ? 'bg-brand-cream/40' : 'bg-white/10'
                }`} 
              />
            ))}
          </div>

          {/* Instruction */}
          <div className="absolute bottom-24 left-6 right-6 text-center">
            <p className="text-brand-cream text-lg md:text-xl font-light drop-shadow-lg">
              {steps[step].description}
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4 py-4">
          {capturedImages.length < steps.length ? (
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={captureFrame}
                className="w-20 h-20 rounded-full bg-brand-cream flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-full border-4 border-brand-ink/10 flex items-center justify-center">
                  <Camera size={32} className="text-brand-ink" />
                </div>
              </button>
              <p className="text-brand-cream text-[10px] uppercase font-bold tracking-widest opacity-60">Tap to Capture</p>
            </div>
          ) : (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="btn-primary px-12 py-4 flex items-center gap-3 text-lg"
              onClick={handleComplete}
            >
              <Check size={24} /> Complete 3D Capture
            </motion.button>
          )}
        </div>

        {/* Captured Thumbnails */}
        <div className="flex justify-center gap-2 pb-4 overflow-x-auto">
          {capturedImages.map((img, i) => (
            <div key={i} className="w-12 h-16 rounded-sm overflow-hidden border border-white/20 flex-shrink-0">
              <img src={img} alt={`Capture ${i}`} className="w-full h-full object-cover" />
            </div>
          ))}
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
