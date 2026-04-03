/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Box, 
  ChevronLeft, 
  CheckCircle2, 
  RefreshCw,
  Image as ImageIcon,
  Copy,
  Plus,
  X,
  Sparkles,
  Cloud,
  Loader2,
  FolderOpen,
  Save,
  Download,
  Settings,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Link as LinkIcon } from 'lucide-react';
import { 
  generateReplacementPrompt, 
  generateDesignImage,
  DEFAULT_MASTER_PROMPT,
  DEFAULT_EXTEND_PROMPT,
  DEFAULT_STAGE_PROMPT
} from './lib/gemini';
import { openPicker } from './lib/googleDrive';
import { resizeImage } from './lib/imageUtils';
import { AuthProvider, useAuth, LoginPage, UserProfile } from './components/Auth';
import { Library } from './components/Library';
import { saveProject, Project, getProjectById, updateProjectSharing } from './services/projectService';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';

type Step = 'room' | 'cabinets' | 'visualizing' | 'result' | 'library';

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [sharedProject, setSharedProject] = React.useState<Project | null>(null);
  const [loadingShared, setLoadingShared] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return !!new URLSearchParams(window.location.search).get('share');
    }
    return false;
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    console.log('AppContent useEffect, shareId:', shareId);
    if (shareId) {
      setLoadingShared(true);
      getProjectById(shareId).then(project => {
        console.log('AppContent getProjectById result:', project ? 'Project found' : 'Project NOT found');
        if (project) {
          console.log('AppContent project isPublic:', project.isPublic);
          if (project.isPublic) {
            setSharedProject(project);
          } else {
            console.log('AppContent project is NOT public, showing login');
          }
        }
        setLoadingShared(false);
      }).catch((err) => {
        console.error('AppContent getProjectById error:', err);
        setLoadingShared(false);
      });
    }
  }, []);

  if (authLoading || loadingShared) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/20" />
      </div>
    );
  }

  if (sharedProject) {
    return <MainApp initialProject={sharedProject} isPublicView={true} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <MainApp />;
}

function MainApp({ initialProject, isPublicView = false }: { initialProject?: Project, isPublicView?: boolean }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(isPublicView ? 'result' : 'room');
  const [roomImage, setRoomImage] = useState<string | null>(initialProject?.roomImage || null);
  const [cabinetImages, setCabinetImages] = useState<string[]>(initialProject?.cabinetImages || []);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(initialProject?.generatedPrompt || null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(initialProject?.generatedImage || null);
  const [extendToCeiling, setExtendToCeiling] = useState(initialProject?.extendToCeiling || false);
  const [stageRoom, setStageRoom] = useState(initialProject?.stageRoom || false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState(DEFAULT_MASTER_PROMPT);
  const [extendPrompt, setExtendPrompt] = useState(DEFAULT_EXTEND_PROMPT);
  const [stagePrompt, setStagePrompt] = useState(DEFAULT_STAGE_PROMPT);
  const [generateOnlyPrompt, setGenerateOnlyPrompt] = useState(false);
  const [loadedMasterPrompt, setLoadedMasterPrompt] = useState<string | null>(initialProject?.masterPrompt || null);
  const [isLoadedProject, setIsLoadedProject] = useState(!!initialProject);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProject?.id || null);
  const [isPublic, setIsPublic] = useState(initialProject?.isPublic || false);
  const [showSlider, setShowSlider] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roomInputRef = useRef<HTMLInputElement>(null);
  const cabinetInputRef = useRef<HTMLInputElement>(null);

  const handleRoomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setRoomImage(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCabinetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const resized = await resizeImage(reader.result as string);
          setCabinetImages(prev => [...prev, resized]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleGoogleDriveRoom = async () => {
    console.log('Google Drive Room Upload triggered');
    console.log('VITE_GOOGLE_CLIENT_ID (from process.env):', process.env.VITE_GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING');
    console.log('VITE_GOOGLE_API_KEY (from process.env):', process.env.VITE_GOOGLE_API_KEY ? 'PRESENT' : 'MISSING');

    if (!process.env.VITE_GOOGLE_CLIENT_ID || !process.env.VITE_GOOGLE_API_KEY) {
      setError("Google Drive credentials are not configured. Please add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY to the Secrets panel.");
      return;
    }
    try {
      const images = await openPicker();
      if (images.length > 0) {
        const resized = await resizeImage(images[0]);
        setRoomImage(resized);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to access Google Drive. Please check your configuration.");
    }
  };

  const handleGoogleDriveCabinets = async () => {
    if (!process.env.VITE_GOOGLE_CLIENT_ID || !process.env.VITE_GOOGLE_API_KEY) {
      setError("Google Drive credentials are not configured. Please add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY to the Secrets panel.");
      return;
    }
    try {
      const images = await openPicker();
      if (images.length > 0) {
        const resizedImages = await Promise.all(images.map(img => resizeImage(img)));
        setCabinetImages(prev => [...prev, ...resizedImages]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to access Google Drive. Please check your configuration.");
    }
  };

  const removeCabinetImage = (index: number) => {
    setCabinetImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGeneratePrompt = async () => {
    if (!roomImage || cabinetImages.length === 0) return;
    
    setLoading(true);
    setStep('visualizing');
    setError(null);
    setLoadedMasterPrompt(null);
    setIsLoadedProject(false);
    setShowSlider(false);
    try {
      const prompt = await generateReplacementPrompt(
        roomImage, 
        cabinetImages, 
        extendToCeiling, 
        stageRoom,
        {
          master: masterPrompt,
          extend: extendPrompt,
          stage: stagePrompt
        }
      );
      setGeneratedPrompt(prompt);
      
      if (generateOnlyPrompt) {
        setStep('result');
        setLoading(false);
        return;
      }

      // Generate the image using the same context
      try {
        const image = await generateDesignImage(roomImage, cabinetImages, prompt);
        const resizedImage = await resizeImage(image);
        setGeneratedImage(resizedImage);
      } catch (imgErr) {
        console.error("Image generation failed:", imgErr);
        // We don't block the result if only the image fails
      }
      
      setStep('result');
    } catch (err) {
      console.error(err);
      setError("Something went wrong during analysis. Please try again.");
      setStep('cabinets');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('room');
    setRoomImage(null);
    setCabinetImages([]);
    setExtendToCeiling(false);
    setStageRoom(false);
    setGeneratedPrompt(null);
    setGeneratedImage(null);
    setShowPrompt(false);
    setLoadedMasterPrompt(null);
    setIsLoadedProject(false);
    setCurrentProjectId(null);
    setIsPublic(false);
    setShowSlider(false);
    setError(null);
    // Clear URL if it was a shared view
    if (window.location.search.includes('share=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const copyToClipboard = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
    }
  };

  const handleShare = async () => {
    if (!currentProjectId) return;
    
    setSharing(true);
    try {
      const newPublicState = !isPublic;
      await updateProjectSharing(currentProjectId, newPublicState);
      setIsPublic(newPublicState);
      
      if (newPublicState) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${currentProjectId}`;
        await navigator.clipboard.writeText(shareUrl);
        setSuccess("Link copied to clipboard! Anyone with this link can view this design.");
      } else {
        setSuccess("Sharing disabled. This project is now private.");
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setError("Failed to update sharing settings.");
    } finally {
      setSharing(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `cabino-design-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveProject = async () => {
    if (!roomImage || !generatedPrompt) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const projectId = await saveProject({
        roomImage,
        cabinetImages,
        generatedPrompt,
        generatedImage,
        extendToCeiling,
        stageRoom,
        masterPrompt: extendToCeiling ? extendPrompt : (stageRoom ? stagePrompt : masterPrompt)
      });
      setSuccess("Project saved to your library!");
      setIsLoadedProject(true);
      setCurrentProjectId(projectId!);
      setIsPublic(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const loadProject = (project: Project) => {
    setRoomImage(project.roomImage);
    setCabinetImages(project.cabinetImages);
    setGeneratedPrompt(project.generatedPrompt);
    setGeneratedImage(project.generatedImage);
    setExtendToCeiling(project.extendToCeiling);
    setStageRoom(project.stageRoom);
    setLoadedMasterPrompt(project.masterPrompt || null);
    setIsLoadedProject(true);
    setCurrentProjectId(project.id || null);
    setIsPublic(project.isPublic || false);
    setStep('result');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-black/5 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-lg shadow-black/10">
            <Box className="text-white w-5 h-5" />
          </div>
          <h1 className="font-semibold tracking-tight text-lg">Cabino</h1>
        </div>
        <div className="flex items-center gap-4">
          {step !== 'room' && step !== 'visualizing' && step !== 'library' && (
            <button 
              onClick={reset}
              className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button 
            onClick={() => setStep('library')}
            className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-all ${step === 'library' ? 'text-black' : 'opacity-50 hover:opacity-100'}`}
          >
            <FolderOpen className="w-3 h-3" />
            Library
          </button>
          <button 
            onClick={() => setShowDebug(true)}
            className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            title="Debug Prompts"
          >
            <Terminal className="w-5 h-5 opacity-50" />
          </button>
          <UserProfile />
        </div>
      </header>

      {/* Debug Modal */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <Terminal className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Master Prompts</h2>
                    <p className="text-xs text-black/40 font-bold uppercase tracking-widest">Debug Mode</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDebug(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40">Base Master Prompt</label>
                  <textarea 
                    value={masterPrompt}
                    onChange={(e) => setMasterPrompt(e.target.value)}
                    className="w-full h-48 p-6 bg-[#F5F5F5] rounded-2xl text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40">Extend to Ceiling Prompt</label>
                  <textarea 
                    value={extendPrompt}
                    onChange={(e) => setExtendPrompt(e.target.value)}
                    className="w-full h-48 p-6 bg-[#F5F5F5] rounded-2xl text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/40">Stage Amendment Prompt</label>
                  <textarea 
                    value={stagePrompt}
                    onChange={(e) => setStagePrompt(e.target.value)}
                    className="w-full h-48 p-6 bg-[#F5F5F5] rounded-2xl text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="p-8 bg-[#F5F5F5] border-t border-black/5 flex gap-4">
                <button 
                  onClick={() => {
                    setMasterPrompt(DEFAULT_MASTER_PROMPT);
                    setExtendPrompt(DEFAULT_EXTEND_PROMPT);
                    setStagePrompt(DEFAULT_STAGE_PROMPT);
                  }}
                  className="flex-1 py-4 bg-white border border-black/5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black/5 transition-all"
                >
                  Reset to Defaults
                </button>
                <button 
                  onClick={() => setShowDebug(false)}
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition-all shadow-lg shadow-black/20"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`pt-24 pb-20 px-6 mx-auto transition-all duration-500 ${step === 'result' ? 'max-w-5xl' : 'max-w-md'}`}>
        <AnimatePresence mode="wait">
          {step === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Library onBack={() => setStep('room')} onLoadProject={loadProject} />
            </motion.div>
          )}

          {step === 'room' && (
            <motion.div
              key="room"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-light tracking-tight leading-tight">Your Space</h2>
                <p className="text-black/50 text-sm leading-relaxed">Upload a photo of the room where you want to replace the cabinets.</p>
              </div>

              <div 
                onClick={() => roomInputRef.current?.click()}
                className="aspect-[4/5] bg-white rounded-[2.5rem] border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-black/20 transition-all group shadow-sm hover:shadow-md overflow-hidden relative"
              >
                {roomImage ? (
                  <>
                    <img src={roomImage} alt="Room" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 backdrop-blur-sm">
                      <RefreshCw className="w-8 h-8" />
                      <p className="font-semibold">Change Photo</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-10 h-10 text-black/40" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg">Upload Room Photo</p>
                      <p className="text-xs text-black/40">Tap to browse files</p>
                    </div>
                  </>
                )}
                <input 
                  type="file" 
                  ref={roomInputRef} 
                  onChange={handleRoomUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => roomInputRef.current?.click()}
                  className="flex-1 py-4 bg-white border border-black/5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:bg-black/5 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Local File
                </button>
                <button 
                  onClick={handleGoogleDriveRoom}
                  className="flex-1 py-4 bg-white border border-black/5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:bg-black/5 transition-all"
                >
                  <Cloud className="w-4 h-4" />
                  Google Drive
                </button>
              </div>

              <div className="space-y-4">
                <div 
                  onClick={() => setExtendToCeiling(!extendToCeiling)}
                  className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between group ${extendToCeiling ? 'bg-black border-black shadow-xl shadow-black/20' : 'bg-white border-black/5 hover:border-black/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${extendToCeiling ? 'bg-white/10' : 'bg-black/5'}`}>
                      <Sparkles className={`w-6 h-6 ${extendToCeiling ? 'text-white' : 'text-black/40'}`} />
                    </div>
                    <div className="space-y-0.5">
                      <p className={`font-semibold text-base ${extendToCeiling ? 'text-white' : 'text-black'}`}>Extend to Ceiling</p>
                      <p className={`text-xs ${extendToCeiling ? 'text-white/60' : 'text-black/40'}`}>Eliminate gaps above cabinets</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${extendToCeiling ? 'border-white bg-white' : 'border-black/10'}`}>
                    {extendToCeiling && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                </div>

                <div 
                  onClick={() => setStageRoom(!stageRoom)}
                  className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between group ${stageRoom ? 'bg-black border-black shadow-xl shadow-black/20' : 'bg-white border-black/5 hover:border-black/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${stageRoom ? 'bg-white/10' : 'bg-black/5'}`}>
                      <Camera className={`w-6 h-6 ${stageRoom ? 'text-white' : 'text-black/40'}`} />
                    </div>
                    <div className="space-y-0.5">
                      <p className={`font-semibold text-base ${stageRoom ? 'text-white' : 'text-black'}`}>Stage</p>
                      <p className={`text-xs ${stageRoom ? 'text-white/60' : 'text-black/40'}`}>Add professional decor & lighting</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${stageRoom ? 'border-white bg-white' : 'border-black/10'}`}>
                    {stageRoom && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                </div>

                {roomImage && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setStep('cabinets')}
                    className="w-full py-6 bg-black text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Next
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'cabinets' && (
            <motion.div
              key="cabinets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setStep('room')}
                className="flex items-center gap-2 text-black/40 hover:text-black transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-bold uppercase tracking-widest">Back</span>
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-black/40">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Step 2 of 2</span>
                </div>
                <h2 className="text-4xl font-light tracking-tight leading-tight">New Cabinets</h2>
                <p className="text-black/50 text-sm leading-relaxed">Upload photos of the cabinets you want to see in your room.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {cabinetImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden border border-black/5 shadow-sm group">
                    <img src={img} alt="Cabinet" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => removeCabinetImage(idx)}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => cabinetInputRef.current?.click()}
                  className="aspect-square bg-white rounded-3xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-2 hover:border-black/20 transition-all group"
                >
                  <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-black/40" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Add Photo</span>
                  <input 
                    type="file" 
                    ref={cabinetInputRef} 
                    onChange={handleCabinetUpload} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                </button>
                <button 
                  onClick={handleGoogleDriveCabinets}
                  className="aspect-square bg-white rounded-3xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-2 hover:border-black/20 transition-all group"
                >
                  <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Cloud className="w-6 h-6 text-black/40" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">From Drive</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100">
                  {error}
                </div>
              )}

              <div 
                onClick={() => setGenerateOnlyPrompt(!generateOnlyPrompt)}
                className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between group ${generateOnlyPrompt ? 'bg-black border-black shadow-xl shadow-black/20' : 'bg-white border-black/5 hover:border-black/10'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${generateOnlyPrompt ? 'bg-white/10' : 'bg-black/5'}`}>
                    <Terminal className={`w-6 h-6 ${generateOnlyPrompt ? 'text-white' : 'text-black/40'}`} />
                  </div>
                  <div className="space-y-0.5">
                    <p className={`font-semibold text-base ${generateOnlyPrompt ? 'text-white' : 'text-black'}`}>Prompt Only</p>
                    <p className={`text-xs ${generateOnlyPrompt ? 'text-white/60' : 'text-black/40'}`}>Generate prompt without image</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${generateOnlyPrompt ? 'border-white bg-white' : 'border-black/10'}`}>
                  {generateOnlyPrompt && <CheckCircle2 className="w-4 h-4 text-black" />}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setStep('room')}
                  className="w-16 h-16 bg-white border border-black/5 rounded-2xl flex items-center justify-center hover:bg-black/5 transition-colors shadow-sm"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleGeneratePrompt}
                  disabled={cabinetImages.length === 0}
                  className="flex-1 bg-black text-white rounded-2xl h-16 font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30 transition-all shadow-lg shadow-black/20 active:scale-[0.98]"
                >
                  Visualize Your New Space
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'visualizing' && (
            <motion.div
              key="visualizing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center"
            >
              <div className="relative">
                <div className="w-32 h-32 border-4 border-black/5 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-black rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-black/20 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-light tracking-tight">Visualizing Your New Space</h2>
                <p className="text-black/40 text-sm max-w-[280px] mx-auto leading-relaxed">
                  Gemini is analyzing your room and cabinets to craft the perfect visualization...
                </p>
              </div>
            </motion.div>
          )}

          {step === 'result' && generatedPrompt && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setStep('cabinets')}
                className="flex items-center gap-2 text-black/40 hover:text-black transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-bold uppercase tracking-widest">Back to Cabinets</span>
              </button>

              <div className="space-y-2">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isLoadedProject ? 'Saved Project' : 'Visualization Ready'}
                    </span>
                  </div>
                  <h2 className="text-4xl font-light tracking-tight leading-tight">
                    {isLoadedProject ? 'Design Details' : 'Your New Kitchen'}
                  </h2>
                  <p className="text-black/50 text-sm leading-relaxed">
                    {isLoadedProject 
                      ? 'Review the details of your saved design visualization.' 
                      : 'Here is the photorealistic visualization of your new cabinet design.'}
                  </p>
                </div>
              </div>

              {generatedImage && (
                <div className="space-y-4">
                  <div className="bg-white rounded-[2.5rem] overflow-hidden border border-black/5 shadow-xl flex items-center justify-center bg-black/5 relative group">
                    {showSlider && roomImage ? (
                      <BeforeAfterSlider 
                        beforeImage={roomImage} 
                        afterImage={generatedImage} 
                      />
                    ) : (
                      <img 
                        src={generatedImage} 
                        alt="Generated Design" 
                        className="max-w-full max-h-[85vh] object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <button 
                      onClick={() => setStep('cabinets')}
                      className="absolute top-4 right-4 w-12 h-12 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-30"
                      title="Close Visualization"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {roomImage && (
                    <button 
                      onClick={() => setShowSlider(!showSlider)}
                      className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-2 mx-auto"
                    >
                      {showSlider ? 'Show Full Design' : 'Show Before/After Slider'}
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-4 max-w-2xl mx-auto w-full">
                <button 
                  onClick={() => setShowPrompt(!showPrompt)}
                  className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-2 mx-auto"
                >
                  {showPrompt ? 'Hide AI Prompt' : 'View AI Prompt'}
                  <ChevronLeft className={`w-3 h-3 transition-transform ${showPrompt ? 'rotate-90' : '-rotate-90'}`} />
                </button>

                <AnimatePresence>
                  {showPrompt && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white rounded-[2rem] p-8 border border-black/5 shadow-xl relative group">
                        <p className="text-sm leading-relaxed text-black/80 font-mono whitespace-pre-wrap italic">
                          "{generatedPrompt}"
                        </p>
                        {loadedMasterPrompt && (
                          <div className="mt-6 pt-6 border-t border-black/5">
                            <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mb-2">Master Prompt Snapshot:</p>
                            <p className="text-xs leading-relaxed text-black/40 font-mono whitespace-pre-wrap">
                              {loadedMasterPrompt}
                            </p>
                          </div>
                        )}
                        <button 
                          onClick={copyToClipboard}
                          className="absolute top-4 right-4 p-2 bg-black/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy Prompt"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="max-w-2xl mx-auto w-full space-y-4">
                <div className={`grid ${isPublicView ? 'grid-cols-1' : 'grid-cols-2'} gap-4 pt-4`}>
                  {!isPublicView && (
                    <button 
                      onClick={reset}
                      className="bg-white border border-black/5 rounded-2xl h-16 font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/5 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <RefreshCw className="w-5 h-5" />
                      New
                    </button>
                  )}
                  <button 
                    onClick={downloadImage}
                    className={`bg-white border border-black/5 rounded-2xl h-16 font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/5 transition-all shadow-sm active:scale-[0.98] ${isPublicView ? 'w-full' : ''}`}
                  >
                    <Download className="w-5 h-5" />
                    Download
                  </button>
                </div>

                {!isPublicView && (
                  <div className="grid grid-cols-1 gap-4 pt-4">
                    {!isLoadedProject ? (
                      <button 
                        onClick={handleSaveProject}
                        disabled={saving}
                        className="w-full bg-black text-white rounded-2xl h-16 font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/90 transition-all shadow-lg shadow-black/20 active:scale-[0.98] disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save Design
                          </>
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={handleShare}
                        disabled={sharing}
                        className={`w-full rounded-2xl h-16 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 ${isPublic ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-white border border-black/5 text-black shadow-black/5'}`}
                      >
                        {sharing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            {isPublic ? <LinkIcon className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                            {isPublic ? 'Copy Share Link' : 'Share with Client'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 text-green-600 p-4 rounded-2xl text-xs font-medium border border-green-100 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </motion.div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-t border-black/5 flex items-center justify-center px-6 z-50">
        <div className="flex gap-6">
          {['room', 'cabinets', 'result', 'library'].map((s, i) => (
            <div 
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                step === s ? 'w-8 bg-black' : 'bg-black/10'
              }`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}
