import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './Auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronRight, Home, Briefcase, Loader2, Sparkles } from 'lucide-react';

export function Onboarding() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'homeowner' | 'professional' | ''>('');
  const [companyName, setCompanyName] = useState('');
  const [tier, setTier] = useState<'free' | 'pro' | ''>('');
  const [saving, setSaving] = useState(false);

  const handleNext = () => {
    if (step === 1 && role === 'professional') {
      setStep(2);
    } else if (step === 1 && role === 'homeowner') {
      setStep(3);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role,
        companyName: role === 'professional' ? companyName : '',
        onboardingCompleted: true
      });

      // Picking "Pro" in onboarding doesn't grant Pro — only a completed
      // Stripe checkout does (the Worker webhook updates subscriptionTier).
      // Kick the user to checkout; if they abandon, they stay on free.
      if (tier === 'pro') {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priceId: 'price_1TIEDYRzxeFhHl8ukjtG21RF',
            userId: user.uid,
            successUrl: window.location.origin,
            cancelUrl: window.location.origin,
          }),
        });
        const data = await response.json() as { url?: string };
        if (data.url) {
          window.location.assign(data.url);
          return;
        }
      }
    } catch (err) {
      console.error("Error saving onboarding:", err);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-black/5"
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-light tracking-tight">Welcome to Cabino</h2>
                <p className="text-black/50">How will you be using Cabino?</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setRole('homeowner')} className={`p-6 rounded-2xl border-2 text-left transition-all ${role === 'homeowner' ? 'border-black bg-black/5' : 'border-black/5 hover:border-black/20'}`}>
                  <Home className="w-8 h-8 mb-4" />
                  <h3 className="font-bold text-lg">Personal</h3>
                  <p className="text-sm text-black/50 mt-1">I'm remodeling my own kitchen.</p>
                </button>
                <button onClick={() => setRole('professional')} className={`p-6 rounded-2xl border-2 text-left transition-all ${role === 'professional' ? 'border-black bg-black/5' : 'border-black/5 hover:border-black/20'}`}>
                  <Briefcase className="w-8 h-8 mb-4" />
                  <h3 className="font-bold text-lg">Professional</h3>
                  <p className="text-sm text-black/50 mt-1">I'm a contractor or designer.</p>
                </button>
              </div>
              <button onClick={handleNext} disabled={!role} className="w-full py-4 bg-black text-white rounded-2xl font-bold uppercase tracking-widest disabled:opacity-30 transition-all flex items-center justify-center gap-2">
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-light tracking-tight">Your Business</h2>
                <p className="text-black/50">What's the name of your company?</p>
              </div>
              <input 
                type="text" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
                placeholder="Company Name" 
                className="w-full p-4 bg-[#F5F5F5] rounded-2xl border border-black/5 focus:outline-none focus:border-black transition-colors text-lg"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-4 bg-white border border-black/5 rounded-2xl font-bold uppercase tracking-widest hover:bg-black/5 transition-all">Back</button>
                <button onClick={handleNext} disabled={!companyName.trim()} className="flex-1 py-4 bg-black text-white rounded-2xl font-bold uppercase tracking-widest disabled:opacity-30 transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-light tracking-tight">Choose Your Plan</h2>
                <p className="text-black/50">You can always upgrade later.</p>
              </div>
              <div className="space-y-4">
                <div onClick={() => setTier('free')} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${tier === 'free' ? 'border-black bg-black/5' : 'border-black/5 hover:border-black/20'}`}>
                  <div>
                    <h3 className="font-bold text-lg">Starter</h3>
                    <p className="text-sm text-black/50 mt-1">3 free designs per month</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">$0</p>
                  </div>
                </div>
                <div onClick={() => setTier('pro')} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between relative overflow-hidden ${tier === 'pro' ? 'border-black bg-black text-white' : 'border-black/5 hover:border-black/20'}`}>
                  {tier === 'pro' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">Pro</h3>
                      <Sparkles className={`w-4 h-4 ${tier === 'pro' ? 'text-yellow-400' : 'text-black/40'}`} />
                    </div>
                    <p className={`text-sm mt-1 ${tier === 'pro' ? 'text-white/70' : 'text-black/50'}`}>Unlimited designs & priority generation</p>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="font-bold text-xl">$29<span className={`text-sm font-normal ${tier === 'pro' ? 'text-white/70' : 'text-black/50'}`}>/mo</span></p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(role === 'professional' ? 2 : 1)} className="px-6 py-4 bg-white border border-black/5 rounded-2xl font-bold uppercase tracking-widest hover:bg-black/5 transition-all">Back</button>
                <button onClick={handleComplete} disabled={!tier || saving} className="flex-1 py-4 bg-black text-white rounded-2xl font-bold uppercase tracking-widest disabled:opacity-30 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
