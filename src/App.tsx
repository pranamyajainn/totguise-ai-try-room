import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Camera, Sparkles, ArrowLeft, RefreshCw, Check, ShoppingBag, Instagram, Facebook, RotateCw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PRODUCTS } from './constants';
import { Product, AppState } from './types';
import { Capture3D } from './components/Capture3D';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [state, setState] = useState<AppState>('upload');
  const [userImages, setUserImages] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isKeySelecting, setIsKeySelecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newImages: string[] = [];
      let processed = 0;
      
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newImages.push(e.target?.result as string);
          processed++;
          if (processed === files.length) {
            setUserImages(prev => [...prev, ...newImages].slice(0, 5)); // Limit to 5
            setState('select');
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleTryOn = async (product: Product) => {
    if (userImages.length === 0) return;

    // Check for API key selection for high-quality model
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setIsKeySelecting(true);
        await window.aistudio.openSelectKey();
        setIsKeySelecting(false);
      }
    } catch (e) {
      console.error("Key selection error:", e);
    }
    
    setSelectedProduct(product);
    setState('generating');
    setError(null);

    try {
      // Create a fresh instance to use the latest API key
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please select an API key or add GEMINI_API_KEY to your environment variables.");
      }
      const ai = new GoogleGenAI({ apiKey });

      // Convert all user photos to base64
      const userPhotoParts = userImages.map(img => {
        const base64 = img.split(',')[1];
        const mimeType = img.split(';')[0].split(':')[1] || 'image/jpeg';
        return {
          inlineData: {
            data: base64,
            mimeType: mimeType,
          },
        };
      });
      
      // Fetch and convert product image to base64 via proxy
      let garmentBase64 = '';
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(product.imageUrl)}`;
        const garmentResponse = await fetch(proxyUrl);
        if (!garmentResponse.ok) throw new Error(`Failed to fetch garment image: ${garmentResponse.statusText}`);
        const garmentBlob = await garmentResponse.blob();
        garmentBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(garmentBlob);
        });
      } catch (fetchErr) {
        console.error("Garment fetch error:", fetchErr);
        throw new Error("Could not load the garment image. This might be a temporary network issue or a CORS restriction.");
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            ...userPhotoParts,
            {
              inlineData: {
                data: garmentBase64,
                mimeType: 'image/jpeg',
              },
            },
            {
              text: `You are an elite virtual fashion stylist and tailor. I am providing ${userImages.length} reference images of a person (SOURCE PHOTOS) from different angles and one TARGET GARMENT image.

              TASK: Generate a photorealistic, high-fashion editorial image of the person from the SOURCE PHOTOS wearing the TARGET GARMENT.

              STRICT CONSTRAINTS:
              - FACIAL INTEGRITY: Use all provided SOURCE PHOTOS to reconstruct the person's face with 100% accuracy. The final face must be an IDENTICAL, PIXEL-PERFECT match to the person in the photos. Maintain every unique facial feature, expression, and detail from multiple angles.
              - GARMENT PRECISION: The garment's print, pattern, color, and texture must be 100% IDENTICAL to the TARGET GARMENT image. Every detail of the "${product.name}" print must be perfectly preserved without any distortion, simplification, or alteration.
              - FIT & POSE: The garment should fit the person naturally and realistically. The pose should be professional and showcase the garment's design clearly.
              - STUDIO SETTING: Use a clean, minimal, warm cream-toned studio background with professional lighting.
              - OUTPUT QUALITY: The final output must be high-resolution (2K), sharp, and indistinguishable from a real fashion photograph.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            imageSize: "2K"
          }
        }
      });

      let foundImage = false;
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            setResultImage(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          }
        }
      }

      if (foundImage) {
        setState('result');
      } else {
        throw new Error("The model did not return an image. This can happen if the input images were unclear or violated safety guidelines.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while generating your look. Please try again.");
      setState('select');
    }
  };

  const reset = () => {
    setUserImages([]);
    setSelectedProduct(null);
    setResultImage(null);
    setState('upload');
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-serif font-semibold text-brand-accent lowercase leading-none">totguise</h1>
          <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] opacity-50 font-medium mt-1">Studio</span>
        </div>
        {state !== 'upload' && (
          <button 
            onClick={reset}
            className="text-[10px] md:text-sm uppercase tracking-widest font-medium opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 md:gap-2 min-h-[44px] px-2"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Start Over</span>
            <span className="sm:hidden">Reset</span>
          </button>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 pb-12">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*" 
          multiple
          className="hidden" 
        />
        <AnimatePresence mode="wait">
          {state === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[80vh] text-center py-12 md:py-20 px-4"
            >
              <div className="max-w-5xl w-full">
                <h2 className="text-5xl sm:text-7xl md:text-9xl mb-8 leading-[0.85] tracking-tighter font-serif">Try It On, Virtually</h2>
                <p className="text-base sm:text-lg md:text-xl opacity-70 mb-12 md:mb-20 font-light max-w-2xl mx-auto leading-relaxed">
                  Experience the future of tailoring. Provide multiple photos or use our advanced 3D capture for a perfect fit.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 max-w-4xl mx-auto">
                  <div 
                    onClick={triggerUpload}
                    className="group relative cursor-pointer"
                  >
                    <div className="absolute -inset-3 bg-brand-ink/5 rounded-sm scale-95 group-hover:scale-100 transition-transform duration-700" />
                    <div className="relative glass-panel p-10 md:p-12 flex flex-col items-center gap-8 border-dashed border-2 border-brand-ink/10 h-full min-h-[300px] justify-center">
                      <div className="w-20 h-20 rounded-sm bg-brand-ink text-brand-cream flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-700">
                        <Upload size={36} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-xl mb-3">Upload Photos</p>
                        <p className="text-sm opacity-60 leading-relaxed max-w-[240px] mx-auto">Select 3+ photos from different angles for best results</p>
                      </div>
                      
                      <div className="w-full">
                        <div className="bg-brand-ink text-brand-cream py-4 rounded-sm text-[10px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-3 group-hover:bg-brand-ink/90 transition-colors shadow-xl">
                          Select Files <Upload size={16} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setState('capture3d')}
                    className="group relative cursor-pointer"
                  >
                    <div className="absolute -inset-3 bg-brand-ink/5 rounded-sm scale-95 group-hover:scale-100 transition-transform duration-700" />
                    <div className="relative glass-panel p-10 md:p-12 flex flex-col items-center gap-8 border-brand-ink/10 h-full bg-brand-ink text-brand-cream overflow-hidden min-h-[300px] justify-center">
                      <div className="absolute top-0 right-0 p-5">
                        <span className="bg-brand-cream text-brand-ink text-[10px] font-bold px-5 py-2 rounded-full uppercase tracking-widest shadow-2xl">Advanced AI</span>
                      </div>
                      <div className="w-20 h-20 rounded-sm bg-brand-cream text-brand-ink flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-700">
                        <Camera size={36} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-xl mb-3">3D Capture Mode</p>
                        <p className="text-sm opacity-60 leading-relaxed max-w-[240px] mx-auto">Interactive 360° facial scanning for precision tailoring</p>
                      </div>
                      
                      <div className="w-full">
                        <div className="bg-brand-cream text-brand-ink py-4 rounded-sm text-[10px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-3 group-hover:bg-white transition-colors shadow-xl">
                          Launch Scanner <Sparkles size={16} />
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-brand-cream/10 overflow-hidden">
                        <motion.div 
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                          className="h-full w-1/3 bg-brand-cream/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                  <div className="glass-panel p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Tip 01</p>
                    <p className="text-xs leading-relaxed">Use natural, even lighting for the clearest facial details.</p>
                  </div>
                  <div className="glass-panel p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Tip 02</p>
                    <p className="text-xs leading-relaxed">Provide front, left, and right profile views for 3D accuracy.</p>
                  </div>
                  <div className="glass-panel p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Tip 03</p>
                    <p className="text-xs leading-relaxed">Avoid busy backgrounds to help the AI focus on you.</p>
                  </div>
                </div>

                {userImages.length > 0 && (
                  <div className="mt-12">
                    <p className="text-xs uppercase tracking-widest font-bold opacity-40 mb-4">Ready to proceed with {userImages.length} photos</p>
                    <button 
                      onClick={() => setState('select')}
                      className="btn-primary px-8 py-3 flex items-center gap-2 mx-auto"
                    >
                      Continue to Selection <ArrowLeft className="rotate-180" size={18} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {state === 'capture3d' && (
            <Capture3D 
              onComplete={(images) => {
                setUserImages(prev => [...prev, ...images].slice(0, 10));
                setState('select');
              }}
              onCancel={() => setState('upload')}
            />
          )}

          {state === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12"
            >
              <div className="md:col-span-4 space-y-6 md:space-y-8">
                <div className="md:sticky md:top-8">
                  <div className="flex items-center gap-4 mb-6">
                    <button 
                      onClick={() => setState('upload')} 
                      className="p-3 hover:bg-brand-ink/5 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Go back"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-2xl md:text-3xl">Your Photos</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4 max-h-[300px] md:max-h-none overflow-y-auto pr-1">
                    {userImages.map((img, i) => (
                      <div key={i} className={`aspect-[3/4] rounded-sm overflow-hidden bg-white shadow-lg relative ${i === 0 ? 'col-span-2' : ''}`}>
                        <img src={img} alt={`You ${i}`} className="w-full h-full object-cover" />
                        {i === 0 && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-brand-ink text-brand-cream text-[8px] px-2 py-1 rounded-full uppercase tracking-widest font-bold">Primary</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => triggerUpload()}
                      className="btn-secondary w-full flex items-center justify-center gap-2 min-h-[48px] text-sm"
                    >
                      <Upload size={18} /> Add More Photos
                    </button>
                    <button 
                      onClick={() => setState('capture3d')}
                      className="btn-secondary w-full flex items-center justify-center gap-2 min-h-[48px] text-sm bg-brand-ink text-brand-cream hover:bg-brand-ink/90"
                    >
                      <RotateCw size={18} /> 3D Capture
                    </button>
                  </div>

                  {error && (
                    <div className="mt-4 p-4 bg-brand-error/10 text-brand-error rounded-sm text-sm font-medium">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-8">
                <div className="mb-8">
                  <h2 className="text-3xl md:text-4xl mb-2">Select a Piece</h2>
                  <p className="text-sm md:text-base opacity-60">Choose a garment from our whimsical collection to try on.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {PRODUCTS.map((product) => (
                    <motion.div 
                      key={product.id}
                      whileHover={{ y: -8 }}
                      className="glass-panel overflow-hidden group cursor-pointer flex flex-col"
                      onClick={() => handleTryOn(product)}
                    >
                      <div className="aspect-[4/5] overflow-hidden relative">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-brand-ink/0 group-hover:bg-brand-ink/10 transition-colors duration-500" />
                        {/* Visible on mobile/tablet, hover on desktop */}
                        <div className="absolute bottom-4 right-4 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-300">
                          <div className="bg-white text-brand-ink px-4 py-3 md:py-2 rounded-sm text-xs md:text-sm font-medium flex items-center gap-2 shadow-lg min-h-[44px]">
                            Try it on <Sparkles size={14} />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 md:p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h3 className="text-lg md:text-xl leading-tight">{product.name}</h3>
                            <span className="font-medium text-sm md:text-base whitespace-nowrap">{product.price}</span>
                          </div>
                          <p className="text-xs md:text-sm opacity-60 line-clamp-2">{product.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {state === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] md:h-[70vh] text-center py-12"
            >
              <div className="relative mb-8 md:mb-12">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 md:w-48 md:h-48 border-2 border-dashed border-brand-ink/20 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 md:w-32 md:h-32 bg-brand-ink rounded-full flex items-center justify-center text-brand-cream shadow-2xl"
                  >
                    <Sparkles size={32} className="md:w-10 md:h-10" />
                  </motion.div>
                </div>
              </div>
              <h2 className="text-2xl md:text-4xl mb-4 italic">Tailoring your look...</h2>
              <p className="text-sm md:text-base opacity-60 max-w-xs md:max-w-md mx-auto px-4">
                Our virtual atelier is tailoring the <span className="font-medium text-brand-ink">{selectedProduct?.name}</span> to your photo.
              </p>
              
                <div className="mt-8 md:mt-12 flex gap-3 md:gap-4">
                  <div className="flex -space-x-4">
                    {userImages.slice(0, 3).map((img, i) => (
                      <div key={i} className="w-10 h-14 md:w-12 md:h-16 rounded-sm overflow-hidden border-2 border-brand-cream shadow-lg opacity-60 grayscale">
                        <img src={img} alt="User" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center opacity-20">
                    <div className="w-6 md:w-8 h-[1px] bg-brand-ink" />
                  </div>
                  <div className="w-10 h-14 md:w-12 md:h-16 rounded-sm overflow-hidden opacity-40 grayscale">
                    <img src={selectedProduct?.imageUrl} alt="Product" className="w-full h-full object-cover" />
                  </div>
                </div>
            </motion.div>
          )}

          {state === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center"
            >
              <div className="md:col-span-7">
                <div className="relative max-w-md md:max-w-none mx-auto">
                  <div className="aspect-[3/4] rounded-sm overflow-hidden bg-white shadow-2xl border-4 md:border-8 border-white">
                    <img src={resultImage!} alt="Your Result" className="w-full h-full object-cover" />
                  </div>
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute -right-2 md:-right-6 top-1/4 glass-panel p-4 md:p-6 shadow-xl max-w-[140px] md:max-w-[200px]"
                  >
                    <div className="flex items-center gap-2 text-brand-success mb-2 font-bold text-[10px] md:text-xs uppercase tracking-wider">
                      <Check size={14} /> Tailored
                    </div>
                    <p className="text-xs md:text-sm italic">"The fit is effortless. A perfect match for your next wander."</p>
                  </motion.div>
                </div>
              </div>

              <div className="md:col-span-5 space-y-6 md:space-y-8 text-center md:text-left">
                <div>
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold opacity-40 mb-3 md:mb-4 block">Virtual Fitting Result</span>
                  <h2 className="text-4xl sm:text-5xl md:text-6xl mb-4 leading-tight">{selectedProduct?.name}</h2>
                  <p className="text-base md:text-xl opacity-70 font-light leading-relaxed px-4 md:px-0">
                    {selectedProduct?.description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 md:gap-4 pt-4 px-4 md:px-0">
                  <a 
                    href={selectedProduct?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-primary flex items-center justify-center gap-3 text-base md:text-lg no-underline min-h-[56px] w-full"
                  >
                    Shop This Look — {selectedProduct?.price} <ShoppingBag size={20} />
                  </a>
                  <button 
                    onClick={() => setState('select')}
                    className="btn-secondary flex items-center justify-center gap-2 min-h-[56px] w-full"
                  >
                    <RefreshCw size={18} /> Try another piece
                  </button>
                </div>

                <div className="pt-8 md:pt-12 border-t border-brand-ink/10">
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-sm bg-brand-ink/5 flex items-center justify-center">
                      <Camera size={20} className="opacity-40" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Not quite right?</p>
                      <button 
                        onClick={() => setState('upload')} 
                        className="text-[10px] md:text-xs uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity min-h-[32px]"
                      >
                        Change your photo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-8 md:p-12 text-center border-t border-brand-ink/5">
        <p className="text-lg md:text-xl font-serif italic mb-6 md:mb-8">"Life's a vacation, dress like it"</p>
        <div className="flex justify-center gap-6 mb-6 md:mb-8">
          <a href="https://www.instagram.com/totguise/" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Instagram size={24} />
          </a>
          <a href="https://www.facebook.com/totguise/" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Facebook size={24} />
          </a>
        </div>
        <p className="opacity-30 text-[8px] md:text-[10px] uppercase tracking-[0.4em] px-4">
          Totguise &copy; 2026 &bull; Virtual Atelier
        </p>
      </footer>
    </div>
  );
}
