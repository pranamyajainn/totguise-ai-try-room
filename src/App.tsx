import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Camera, Sparkles, ArrowLeft, RefreshCw, Check, ShoppingBag, Instagram, Facebook, RotateCw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PRODUCTS } from './constants';
import { Product, AppState } from './types';
import { LOGO_BASE64, MAN_BASE64 } from './assets';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const logo = LOGO_BASE64;

const getProxyUrl = (url: string | undefined) => {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

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
              text: `You are given multiple images of a person and one garment image. Your primary directive is to preserve the garment EXACTLY as shown — every print detail, every color, every pattern repeat, every texture must be reproduced with pixel-level fidelity on the person. Do not simplify, interpret, or stylize the print. Do not alter colors. Do not change pattern scale. The garment in the output must be indistinguishable in print and color from the input garment image. Place this exact garment naturally on the person's body, preserving their face, skin tone, hair, and body proportions. Background should be clean, warm, cream-toned.

The garment is specifically: ${product.garment_description}. Reproduce this exact print. Do not deviate.`
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

      console.log("Gemini API Response:", response);

      let foundImage = false;
      const candidates = response.candidates;
      
      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        
        if (candidate.finishReason === 'SAFETY') {
          throw new Error("The request was blocked by safety filters. Please try with a different photo.");
        }
        
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              setResultImage(`data:image/png;base64,${part.inlineData.data}`);
              foundImage = true;
              break;
            }
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
      <header className="p-4 md:p-8 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 md:gap-5">
          <img src={logo} alt="Totguise" className="h-8 md:h-[40px] w-auto object-contain" onError={(e) => e.currentTarget.style.display='none'} />
          <div className="w-[1px] h-4 md:h-6 bg-brand-ink/20 rounded-full"></div>
          <span className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.25em] text-brand-ink/70 font-semibold pt-0.5 md:pt-1">Virtual Try On Studio</span>
        </div>
        {state !== 'upload' && (
          <button 
            onClick={reset}
            className="text-[10px] md:text-xs uppercase tracking-widest font-medium opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center md:gap-2 min-w-[48px] min-h-[48px] md:min-h-[44px] md:px-4"
          >
            <RefreshCw size={20} className="md:w-3.5 md:h-3.5" />
            <span className="hidden md:block">Start Over</span>
          </button>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full pb-20">
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {/* Hero Section */}
              <section className="w-full mb-12 md:mb-24">
                <div className="flex flex-col md:flex-row md:editorial-grid border-y border-brand-border">
                  <div className="aspect-[4/5] md:aspect-[3/4] w-full overflow-hidden border-b md:border-b-0 md:border-r border-brand-border last:border-0">
                    <img 
                      src={getProxyUrl("https://totguise.com/cdn/shop/files/IMG_5634.jpg?v=1766595100&width=1500")} 
                      alt="Bloom Core Shacket" 
                      className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                      crossOrigin="anonymous"
                      onError={(e) => e.currentTarget.style.display='none'}
                    />
                  </div>
                  <div className="aspect-[4/5] md:aspect-[3/4] w-full overflow-hidden border-b md:border-b-0 md:border-r border-brand-border last:border-0">
                    <img 
                      src={getProxyUrl("https://totguise.com/cdn/shop/files/IMG_6058.jpg?v=1766596228&width=1500")} 
                      alt="Dance Town Shacket" 
                      className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                      crossOrigin="anonymous"
                      onError={(e) => e.currentTarget.style.display='none'}
                    />
                  </div>
                  <div className="aspect-[4/5] md:aspect-[3/4] w-full overflow-hidden border-b md:border-b-0 md:border-r border-brand-border last:border-0">
                    <img 
                      src={getProxyUrl("https://totguise.com/cdn/shop/files/IMG_5612.jpg?v=1766597033&width=1500")} 
                      alt="Carnival Stripe Shacket" 
                      className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                      crossOrigin="anonymous"
                      onError={(e) => e.currentTarget.style.display='none'}
                    />
                  </div>
                </div>
                <div className="text-center mt-10 md:mt-12 px-6">
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold opacity-30 mb-4 block">Upload Photos</span>
                  <h2 className="text-[2rem] md:text-7xl italic mb-4 leading-tight">Try It On, Virtually</h2>
                  <p className="text-sm md:text-xl font-light opacity-70 mb-4 px-6 md:px-0">See yourself in Totguise before you shop</p>
                  <p className="text-brand-accent italic font-serif text-lg md:text-xl">Vacation Essentials, On You</p>
                </div>
              </section>

              <div className="max-w-4xl w-full px-4">
                <div className="flex flex-col items-center justify-center">
                  <button 
                    onClick={triggerUpload}
                    className="w-full md:w-auto flex flex-col items-center justify-center p-6 md:p-12 md:px-24 border border-brand-border hover:border-brand-ink/20 transition-all group bg-white min-h-[80px] md:min-h-0"
                  >
                    <div className="hidden md:flex w-16 h-16 rounded-full border border-brand-border items-center justify-center mb-6 group-hover:bg-brand-ink group-hover:text-brand-cream transition-all">
                      <Upload size={24} />
                    </div>
                    <div className="flex items-center gap-4 md:block">
                      <Upload size={24} className="md:hidden opacity-60" />
                      <div className="text-left md:text-center">
                        <span className="text-sm md:text-base uppercase tracking-[0.2em] font-normal block">Upload Your Photo</span>
                        <p className="md:hidden text-[10px] opacity-40 uppercase tracking-widest mt-0.5">Select from your library</p>
                      </div>
                    </div>
                    <p className="hidden md:block text-[10px] opacity-40 mt-2 uppercase tracking-widest">Select from your library</p>
                  </button>
                  <p className="mt-6 text-center text-[#4A4540] italic font-serif text-sm md:text-base">
                    "For best results: stand against a plain wall, good lighting, front facing, full body or waist up"
                  </p>
                </div>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center border-t border-brand-border pt-16">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-4">Step 01</p>
                    <p className="text-sm font-light leading-relaxed">Provide 1-3 clear photos of yourself in simple clothing.</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-4">Step 02</p>
                    <p className="text-sm font-light leading-relaxed">Select a Totguise piece from our latest collection.</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mb-4">Step 03</p>
                    <p className="text-sm font-light leading-relaxed">Our virtual atelier tailors the look to your photo instantly.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {state === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 pt-8"
            >
              <div className="md:col-span-4 space-y-8">
                <div className="md:sticky md:top-8">
                  <div className="flex items-center gap-4 mb-6 md:mb-8">
                    <button 
                      onClick={() => setState('upload')} 
                      className="p-2 hover:bg-brand-ink/5 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Go back"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-2xl md:text-4xl italic">Your Photos</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-6 max-h-[400px] md:max-h-none overflow-y-auto pr-1">
                    {userImages.map((img, i) => (
                      <div key={i} className={`aspect-[3/4] rounded-sm overflow-hidden bg-white border border-brand-border relative ${i === 0 ? 'col-span-2' : ''}`}>
                        <img src={img} alt={`You ${i}`} className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                        {i === 0 && (
                          <div className="absolute top-3 right-3">
                            <div className="bg-brand-ink text-brand-cream text-[8px] px-2 py-1 rounded-sm uppercase tracking-widest font-bold">Primary</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => triggerUpload()}
                      className="btn-secondary w-full flex items-center justify-center gap-3"
                    >
                      <Upload size={18} /> Add Photos
                    </button>
                  </div>

                  {error && (
                    <div className="mt-6 p-4 border border-brand-accent/20 text-brand-accent rounded-sm text-sm font-light">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-8">
                <div className="mb-8 md:mb-12 px-4 md:px-0">
                  <h2 className="text-3xl md:text-5xl italic mb-3">Pick Your Happy Print</h2>
                  <p className="text-sm md:text-lg font-light opacity-60">Choose a garment from our collection to try on.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 px-4 md:px-0">
                  {PRODUCTS.map((product) => (
                    <motion.div 
                      key={product.id}
                      whileHover={{ y: -4 }}
                      className="bg-white border border-brand-border overflow-hidden group cursor-pointer flex flex-col md:block"
                      onClick={() => handleTryOn(product)}
                    >
                      <div className="flex md:block">
                        <div className="w-20 md:w-full aspect-square md:aspect-[4/5] overflow-hidden relative flex-shrink-0">
                          <img 
                            src={getProxyUrl(product.imageUrl)} 
                            alt={product.name} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            onError={(e) => e.currentTarget.style.display='none'}
                          />
                        </div>
                        <div className="p-4 md:p-8 flex-1 flex flex-col justify-center md:justify-between">
                          <div className="flex justify-between items-baseline mb-1 md:mb-2 gap-4">
                            <h3 className="text-base md:text-2xl italic leading-tight truncate">{product.name}</h3>
                            <span className="text-xs md:text-base opacity-40">{product.price}</span>
                          </div>
                          <p className="hidden md:block text-sm font-light opacity-60 line-clamp-2 leading-relaxed">{product.description}</p>
                        </div>
                      </div>
                      <div className="px-4 pb-4 md:hidden">
                        <div className="bg-brand-ink text-brand-cream h-[52px] rounded-sm text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg">
                          Try it on <Sparkles size={14} />
                        </div>
                      </div>
                      <div className="hidden md:block absolute bottom-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                        <div className="bg-brand-ink text-brand-cream px-6 py-3 rounded-sm text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl">
                          Try it on <Sparkles size={14} />
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
              className="flex flex-col items-center justify-center min-h-[60vh] text-center py-20"
            >
              <div className="mb-12">
                <motion.img
                  src={MAN_BASE64}
                  alt="Totguise"
                  className="w-20 h-20 md:w-20 md:h-20 object-contain rounded-full shadow-xl"
                  onError={(e) => e.currentTarget.style.display='none'}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
              <h2 className="text-2xl md:text-6xl italic mb-3">Tailoring your look...</h2>
              <p className="text-brand-accent italic font-serif text-xs md:text-xl mb-8">Prints Made for Happy Days</p>
              <p className="text-sm md:text-xl font-light opacity-60 max-w-md mx-auto px-6">
                Our virtual atelier is tailoring the <span className="font-normal text-brand-ink">{selectedProduct?.name}</span> to your photo.
              </p>
              
              <div className="mt-16 flex gap-6">
                <div className="flex -space-x-6">
                  {userImages.slice(0, 3).map((img, i) => (
                    <div key={i} className="w-16 h-20 md:w-20 md:h-28 rounded-sm overflow-hidden border border-brand-cream shadow-2xl grayscale opacity-40">
                      <img src={img} alt="User" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center opacity-10">
                  <div className="w-12 md:w-20 h-[1px] bg-brand-ink" />
                </div>
                <div className="w-16 h-20 md:w-20 md:h-28 rounded-sm overflow-hidden border border-brand-cream shadow-2xl grayscale opacity-40">
                  <img src={getProxyUrl(selectedProduct?.imageUrl)} alt="Product" className="w-full h-full object-cover" crossOrigin="anonymous" onError={(e) => e.currentTarget.style.display='none'} />
                </div>
              </div>
            </motion.div>
          )}

          {state === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col md:grid md:grid-cols-12 gap-10 md:gap-20 items-center pt-4 md:pt-8 px-4 md:px-0"
            >
              <div className="w-full md:col-span-7">
                <div className="relative max-w-lg mx-auto">
                  <div className="aspect-[3/4] rounded-sm overflow-hidden bg-white shadow-2xl border-8 md:border-[12px] border-white">
                    <img src={resultImage!} alt="Your Result" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display='none'} />
                  </div>
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 }}
                    className="absolute -right-2 md:-right-12 top-1/4 bg-white border border-brand-border p-4 md:p-8 shadow-2xl max-w-[140px] md:max-w-[240px]"
                  >
                    <div className="flex items-center gap-2 md:gap-3 text-brand-accent mb-2 md:mb-4 font-normal text-[8px] md:text-xs uppercase tracking-widest">
                      <Check size={12} className="md:w-4 md:h-4" /> Tailored
                    </div>
                    <p className="text-xs md:text-base italic leading-relaxed">"The fit is effortless. A perfect match for your next wander."</p>
                  </motion.div>
                </div>
              </div>

              <div className="w-full md:col-span-5 space-y-8 md:space-y-10 text-center md:text-left">
                <div>
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold opacity-30 mb-4 block">Virtual Fitting Result</span>
                  <p className="text-brand-accent italic font-serif text-lg md:text-xl mb-4 md:mb-6">Life's a vacation, dress like it</p>
                  <h2 className="text-4xl sm:text-6xl md:text-7xl italic mb-4 md:mb-6 leading-tight">{selectedProduct?.name}</h2>
                  <p className="text-base md:text-xl opacity-70 font-light leading-relaxed">
                    {selectedProduct?.description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 md:gap-4 pt-4 md:pt-4">
                  <a 
                    href={selectedProduct?.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-brand-ink text-brand-cream min-h-[56px] md:h-auto md:btn-primary flex items-center justify-center gap-4 text-base md:text-lg no-underline rounded-sm uppercase tracking-[0.2em] font-normal px-8"
                  >
                    Shop This Look — {selectedProduct?.price} <ShoppingBag size={20} />
                  </a>
                  <button 
                    onClick={() => setState('select')}
                    className="border border-brand-ink/10 min-h-[56px] md:h-auto md:btn-secondary flex items-center justify-center gap-3 rounded-sm text-sm uppercase tracking-[0.2em] font-normal px-8"
                  >
                    <RefreshCw size={18} /> Try another piece
                  </button>
                </div>

                <div className="pt-12 border-t border-brand-border">
                  <div className="flex items-center justify-center md:justify-start gap-6">
                    <div className="w-14 h-14 rounded-full border border-brand-border flex items-center justify-center">
                      <Camera size={24} className="opacity-30" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-normal mb-1">Not quite right?</p>
                      <button 
                        onClick={() => setState('upload')} 
                        className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold opacity-40 hover:opacity-100 hover:text-brand-accent transition-all"
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
      <footer className="p-12 md:p-20 text-center border-t border-brand-border mt-12 md:mt-20 flex flex-col items-center">
        <p className="text-xs md:text-2xl italic mb-8 md:mb-10 font-serif">Loved By Creators. Now Worn By You.</p>
        <div className="flex justify-center gap-6 md:gap-8 mb-0">
          <a href="https://www.instagram.com/totguise/" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 hover:text-brand-accent transition-all min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Instagram size={24} />
          </a>
          <a href="https://www.facebook.com/totguise/" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-100 hover:text-brand-accent transition-all min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Facebook size={24} />
          </a>
        </div>
        <p className="opacity-20 text-[10px] uppercase tracking-[0.5em] px-4">
          Totguise &copy; 2026 &bull; Virtual Atelier
        </p>
      </footer>
    </div>
  );
}
