import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Box, LogIn, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
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
  const { signIn, loading } = useAuth();

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
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-xs font-bold text-black/80">{user.displayName}</p>
        <p className="text-[10px] text-black/40">{user.email}</p>
      </div>
      <button 
        onClick={logout}
        className="w-10 h-10 bg-black/5 hover:bg-black/10 rounded-xl flex items-center justify-center transition-colors group"
        title="Sign Out"
      >
        <LogOut className="w-5 h-5 text-black/40 group-hover:text-black transition-colors" />
      </button>
    </div>
  );
}
