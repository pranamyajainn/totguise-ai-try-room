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
    <div className="fixed inset-0 z-50 bg-brand-cream flex flex-col items-center justify-center p-0 md:p-8">
      <div className="max-w-4xl w-full h-full flex flex-col gap-4 md:gap-8">
        <div className="flex justify-between items-center text-brand-ink p-6 md:p-0">
          <div>
            <h2 className="text-2xl md:text-4xl italic">Take a Photo</h2>
            <p className="text-xs md:text-sm font-light opacity-60">Follow the guide for a precise virtual fitting</p>
          </div>
          <button 
            onClick={onCancel}
            className="p-3 hover:bg-brand-ink/5 rounded-full transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-white shadow-2xl border-y md:border border-brand-border">
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
            <div className="absolute inset-0 flex items-center justify-center bg-brand-cream/95 p-8 text-center">
              <div className="max-w-sm">
                <Camera size={48} className="text-brand-accent mx-auto mb-6 opacity-30" />
                <p className="text-brand-ink text-lg mb-8 font-light">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="btn-primary px-10 py-4"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
          
          {/* Overlay Guide */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-[60%] h-[60%] max-w-[320px] max-h-[400px] md:w-80 md:h-96 border border-brand-ink/20 rounded-[100px] relative">
              <div className="absolute inset-0 border border-brand-ink/10 rounded-[100px] scale-110" />
              
              {/* Step Indicator */}
              <div className="absolute -bottom-12 md:-bottom-16 left-1/2 -translate-x-1/2 w-max">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-brand-ink text-brand-cream px-8 py-3 rounded-sm text-xs uppercase tracking-widest shadow-2xl flex items-center gap-3"
                  >
                    <Sparkles size={14} />
                    {steps[step].label}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="absolute top-8 left-8 right-8 flex gap-3">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 transition-all duration-700 ${
                  i < capturedImages.length ? 'bg-brand-ink' : 
                  i === capturedImages.length ? 'bg-brand-ink/20' : 'bg-brand-ink/5'
                }`} 
              />
            ))}
          </div>

          {/* Instruction */}
          <div className="absolute bottom-24 left-8 right-8 text-center">
            <p className="text-brand-ink text-xl md:text-2xl italic drop-shadow-sm">
              {steps[step].description}
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-6 py-4">
          {capturedImages.length < steps.length ? (
            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={captureFrame}
                className="w-24 h-24 rounded-full border border-brand-border bg-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group"
              >
                <div className="w-20 h-20 rounded-full border border-brand-border flex items-center justify-center group-hover:bg-brand-ink group-hover:text-brand-cream transition-all">
                  <Camera size={32} />
                </div>
              </button>
              <p className="text-brand-ink text-[10px] uppercase font-bold tracking-[0.3em] opacity-40">Capture</p>
            </div>
          ) : (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="btn-primary px-16 py-5 flex items-center gap-4 text-lg"
              onClick={handleComplete}
            >
              <Check size={24} /> Complete Capture
            </motion.button>
          )}
        </div>

        {/* Captured Thumbnails */}
        <div className="flex justify-center gap-3 pb-8 overflow-x-auto">
          {capturedImages.map((img, i) => (
            <div key={i} className="w-16 h-20 rounded-sm overflow-hidden border border-brand-border flex-shrink-0 grayscale opacity-40">
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
