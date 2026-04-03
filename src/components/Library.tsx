import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Trash2, 
  ExternalLink, 
  Clock, 
  ChevronLeft, 
  Loader2,
  FolderOpen
} from 'lucide-react';
import { getProjects, deleteProject, Project } from '../services/projectService';

interface LibraryProps {
  onBack: () => void;
  onLoadProject: (project: Project) => void;
}

export function Library({ onBack, onLoadProject }: LibraryProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-black/20" />
        <p className="text-black/40 text-sm font-medium uppercase tracking-widest">Loading Library...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-black/40 hover:text-black transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Back</span>
        </button>
        <div className="flex items-center gap-2 text-black/20">
          <FolderOpen className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{projects.length} Saved</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-4xl font-light tracking-tight leading-tight">My Library</h2>
        <p className="text-black/50 text-sm leading-relaxed">Your saved kitchen visualizations and prompts.</p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-black/5 text-center space-y-4">
          <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8 text-black/20" />
          </div>
          <p className="text-black/40 text-sm">No saved projects yet. Start a new design to save it here.</p>
          <button 
            onClick={onBack}
            className="px-6 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Start Designing
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {projects.map((project) => (
            <motion.div 
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onLoadProject(project)}
              className="bg-white rounded-[2rem] overflow-hidden border border-black/5 shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="aspect-video relative overflow-hidden bg-black/5">
                {project.generatedImage ? (
                  <img 
                    src={project.generatedImage} 
                    alt="Visualization" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img 
                    src={project.roomImage} 
                    alt="Original Room" 
                    className="w-full h-full object-cover opacity-50 grayscale"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <div className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl">
                    <ExternalLink className="w-4 h-4" />
                    Open Project
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-black/20 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {project.createdAt?.toDate ? project.createdAt.toDate().toLocaleDateString() : 'Recent'}
                    </p>
                    <p className="text-sm line-clamp-2 text-black/60 italic font-mono">
                      "{project.generatedPrompt}"
                    </p>
                    {project.masterPrompt && (
                      <div className="pt-2 border-t border-black/5 mt-2">
                        <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">Master Prompt Used:</p>
                        <p className="text-[10px] text-black/40 line-clamp-1 font-mono mt-1">
                          {project.masterPrompt}
                        </p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      project.id && handleDelete(project.id);
                    }}
                    disabled={deletingId === project.id}
                    className="p-3 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                  >
                    {deletingId === project.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
