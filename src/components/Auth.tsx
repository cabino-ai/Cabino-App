import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Box, LogIn, LogOut, Loader2, AlertCircle, Settings, CreditCard, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountModal } from './AccountModal';

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  subscriptionTier: string;
  role: string;
  companyName: string;
  onboardingCompleted: boolean;
  credits: number;
  creditsResetAt?: number;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfileData | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeDoc: () => void;

    getRedirectResult(auth).catch((err) => {
      console.error("Redirect auth error:", err);
      if (err.message.includes("missing initial state")) {
        setError("Browser privacy settings blocked the login. If you are using an in-app browser (like Instagram or Messages) or Incognito mode, please open this link in standard Safari or Chrome.");
      } else {
        setError(err.message);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const snap = await getDoc(userRef);
          const data = snap.data();
          
          // If the document doesn't exist, OR if it was created by the Stripe extension 
          // and is missing our required app fields (like email or subscriptionTier)
          if (!snap.exists() || !data?.email || !data?.subscriptionTier) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || data?.displayName || '',
              photoURL: firebaseUser.photoURL || data?.photoURL || '',
              subscriptionTier: data?.subscriptionTier || 'free',
              role: data?.role || '',
              companyName: data?.companyName || '',
              onboardingCompleted: data?.onboardingCompleted || false,
              credits: data?.credits !== undefined ? data.credits : 3,
              createdAt: data?.createdAt || serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.error("Error creating user profile:", err);
        }

        // Listen to real-time updates on the user profile.
        // subscriptionTier is updated directly on this document by our Worker webhook.
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfileData);
          }
          setLoading(false);
        });

      } else {
        setUserProfile(null);
        if (unsubscribeDoc) unsubscribeDoc();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const signIn = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      console.error("Error signing in:", err);
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function LoginPage() {
  const { signIn, loading, error } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-12 shadow-xl border border-black/5 text-center space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
            <Box className="text-white w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-tight">Welcome to Cabino</h1>
            <p className="text-black/40 text-sm">Sign in to start visualizing your dream kitchen.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100 flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" />
              Authentication Error
            </div>
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full py-4 bg-black text-white rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-[10px] text-black/30 uppercase tracking-widest font-bold">
          Secure Authentication powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}

export function UserProfile() {
  const { user, userProfile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'profile' | 'billing'>('profile');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 pr-4 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold">{user.displayName?.charAt(0) || user.email?.charAt(0)}</span>
          </div>
        )}
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-black/80 leading-tight">{user.displayName}</p>
          <p className="text-[10px] text-black/40 leading-tight capitalize">{userProfile?.subscriptionTier || 'Free'} Plan</p>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-black/5">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-xs text-black/50 truncate">{user.email}</p>
              {userProfile?.companyName && (
                <p className="text-xs text-black/40 mt-1 truncate flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {userProfile.companyName}
                </p>
              )}
            </div>
            
            <div className="p-2">
              <button 
                onClick={() => { setModalTab('profile'); setIsModalOpen(true); setIsOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm font-medium text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button 
                onClick={() => { setModalTab('billing'); setIsModalOpen(true); setIsOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm font-medium text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Billing
              </button>
            </div>

            <div className="p-2 border-t border-black/5">
              <button 
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <AccountModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            initialTab={modalTab} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
