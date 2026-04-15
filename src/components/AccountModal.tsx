import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, CreditCard, Loader2, CheckCircle2, Sparkles, Briefcase } from 'lucide-react';
import { useAuth } from './Auth';
import { doc, updateDoc, collection, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { db } from '../lib/firebase';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'billing';
}

export function AccountModal({ isOpen, onClose, initialTab = 'profile' }: AccountModalProps) {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'billing'>(initialTab);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDisplayName(user?.displayName || '');
      setCompanyName(userProfile?.companyName || '');
      setSuccessMessage('');
    }
  }, [isOpen, initialTab, user, userProfile]);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMessage('');
    setConfirmDelete(false);
    try {
      // Update Auth Profile
      await updateProfile(user, { displayName });
      
      // Update Firestore Profile
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        companyName
      });
      
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setSaving(true);
    try {
      // Delete user document in Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      // Delete user in Auth
      await deleteUser(user);
      // Auth state will change and close the modal automatically
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/requires-recent-login') {
        setSuccessMessage("Security requirement: Please log out and log back in before deleting your account.");
      } else {
        setSuccessMessage("Error deleting account. Please try again.");
      }
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const handleUpgrade = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
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

      const data = await response.json() as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        setSuccessMessage(`Error: ${data.error || 'Failed to start checkout'}`);
      }
    } catch (error: any) {
      console.error('Error upgrading:', error);
      setSuccessMessage(`Error: ${error.message || 'Failed to start checkout'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, returnUrl: window.location.origin }),
      });

      const data = await response.json() as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.location.assign(data.url);
      } else {
        console.error('Error managing subscription:', data.error);
      }
    } catch (error) {
      console.error('Error managing subscription:', error);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[min(500px,90vh)]"
      >
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 bg-[#F8F8F8] p-6 border-r border-black/5 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-xl font-bold tracking-tight">Account</h2>
            <button onClick={onClose} className="md:hidden p-2 bg-black/5 rounded-full hover:bg-black/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-black' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
          >
            <User className="w-5 h-5" />
            Profile
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'billing' ? 'bg-white shadow-sm text-black' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
          >
            <CreditCard className="w-5 h-5" />
            Billing & Plan
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 relative overflow-y-auto">
          <button onClick={onClose} className="hidden md:flex absolute top-6 right-6 p-2 bg-black/5 rounded-full hover:bg-black/10 transition-colors">
            <X className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8 max-w-md">
                <div>
                  <h3 className="text-2xl font-light tracking-tight mb-1">Profile Settings</h3>
                  <p className="text-sm text-black/50">Manage your personal information.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-black/50 uppercase tracking-wider mb-2">Email Address</label>
                    <input type="email" value={user.email || ''} disabled className="w-full p-3 bg-black/5 rounded-xl border border-transparent text-black/50 cursor-not-allowed" />
                    <p className="text-[10px] text-black/40 mt-1">Email is managed via your Google account.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-black/50 uppercase tracking-wider mb-2">Full Name</label>
                    <input 
                      type="text" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full p-3 bg-white rounded-xl border border-black/10 focus:border-black focus:outline-none transition-colors" 
                    />
                  </div>

                  {userProfile?.role === 'professional' && (
                    <div>
                      <label className="block text-xs font-bold text-black/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> Company Name
                      </label>
                      <input 
                        type="text" 
                        value={companyName} 
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full p-3 bg-white rounded-xl border border-black/10 focus:border-black focus:outline-none transition-colors" 
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-6 py-3 bg-black text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-black/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    {successMessage && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {successMessage}
                      </motion.span>
                    )}
                  </div>

                  <div className="pt-8 mt-4 border-t border-black/5">
                    <h4 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h4>
                    <p className="text-xs text-black/50 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${confirmDelete ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      {confirmDelete ? 'Click again to confirm deletion' : 'Delete Account'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'billing' && (
              <motion.div key="billing" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8 max-w-md">
                <div>
                  <h3 className="text-2xl font-light tracking-tight mb-1">Billing & Plan</h3>
                  <p className="text-sm text-black/50">Manage your subscription and credits.</p>
                </div>

                <div className={`p-6 rounded-2xl border-2 relative overflow-hidden ${userProfile?.subscriptionTier === 'pro' ? 'border-black bg-black text-white' : 'border-black/10 bg-white'}`}>
                  {userProfile?.subscriptionTier === 'pro' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />}
                  
                  <div className="relative z-10 flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-xl capitalize">{userProfile?.subscriptionTier || 'Free'} Plan</h4>
                        {userProfile?.subscriptionTier === 'pro' && <Sparkles className="w-5 h-5 text-yellow-400" />}
                      </div>
                      <p className={`text-sm ${userProfile?.subscriptionTier === 'pro' ? 'text-white/70' : 'text-black/50'}`}>
                        {userProfile?.subscriptionTier === 'pro' ? 'Unlimited designs & priority generation' : '3 free designs per month'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${userProfile?.subscriptionTier === 'pro' ? 'bg-white/20 text-white' : 'bg-black/5 text-black/60'}`}>
                      Active
                    </div>
                  </div>

                  {(() => {
                    const isPro = userProfile?.subscriptionTier === 'pro';
                    const limit = isPro ? 10 : 3;
                    const credits = userProfile?.credits || 0;
                    return (
                      <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Credits Remaining</span>
                          <span className="font-bold">{credits} / {limit}</span>
                        </div>
                        <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black rounded-full"
                            style={{ width: `${Math.min(100, (credits / limit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {userProfile?.subscriptionTier === 'pro' ? (
                    <button 
                      onClick={handleManageSubscription}
                      disabled={saving}
                      className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : 'Manage Subscription'}
                    </button>
                  ) : (
                    <button 
                      onClick={handleUpgrade}
                      disabled={saving}
                      className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-black/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upgrade to Pro - $29/mo'}
                    </button>
                  )}
                </div>

                <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm flex gap-3 border border-blue-100">
                  <div className="mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <p>
                    <strong>Note:</strong> Stripe integration is active. Clicking "Upgrade to Pro" will redirect you to Stripe Checkout. You will need to update the Price ID in the code to match your Stripe dashboard.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
