"use client";

import { motion } from "framer-motion";
import { 
  ChevronLeft, Plus, FolderOpen, Pencil, Copy, Trash2, 
  Layers, Clock, Search, X, Tag, User, MapPin
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, Project } from "@/lib/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

// Polyhaven panoramas (same source the editor uses; served through Next.js'
// image optimizer so the card shows the actual scene photo, fast).
const POLYHAVEN_BASE = "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG";
const sceneThumb = (src: string) =>
  // w must be one of Next.js' allowed image widths (800 is rejected with
  // 400); 1080 is the closest allowed size for the card.
  `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;

interface TemplateScene {
  label: string;
  src: string;
  dimensions: string;
  rentPrice: number;
}

// Each template is ONE scene: one template per scene in the app (10 in
// total), named after the scene, with its dimensions and its own photo.
// Using a template creates a project that opens with just that scene
// (customScenesOnly) instead of the generic event-type scenes.
const SCENE_TEMPLATES: Array<{
  eventType: "Wedding" | "Conference" | "Gala Dinner";
  location: string;
  scene: TemplateScene;
}> = [
  // Wedding (3)
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Dancing Hall", src: `${POLYHAVEN_BASE}/dancing_hall.jpg`, dimensions: "25m x 40m", rentPrice: 1500 } },
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Music Hall", src: `${POLYHAVEN_BASE}/music_hall_02.jpg`, dimensions: "30m x 50m", rentPrice: 2200 } },
  { eventType: "Wedding", location: "Palais Royale", scene: { label: "Pillared Hall", src: `${POLYHAVEN_BASE}/solitude_interior.jpg`, dimensions: "20m x 30m", rentPrice: 1200 } },
  // Conference (4)
  { eventType: "Conference", location: "Convention Center", scene: { label: "Main Theater", src: `${POLYHAVEN_BASE}/theater_02.jpg`, dimensions: "40m x 60m", rentPrice: 3500 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Stage Hall", src: `${POLYHAVEN_BASE}/theater_01.jpg`, dimensions: "35m x 45m", rentPrice: 2800 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Lecture Hall", src: `${POLYHAVEN_BASE}/school_hall.jpg`, dimensions: "20m x 25m", rentPrice: 800 } },
  { eventType: "Conference", location: "Convention Center", scene: { label: "Screening Room", src: `${POLYHAVEN_BASE}/cinema_hall.jpg`, dimensions: "15m x 20m", rentPrice: 600 } },
  // Gala Dinner (3)
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Grand Hall", src: `${POLYHAVEN_BASE}/old_hall.jpg`, dimensions: "45m x 70m", rentPrice: 4500 } },
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Entrance Hall", src: `${POLYHAVEN_BASE}/entrance_hall.jpg`, dimensions: "15m x 30m", rentPrice: 1000 } },
  { eventType: "Gala Dinner", location: "Grand Ballroom", scene: { label: "Long Gallery", src: `${POLYHAVEN_BASE}/large_corridor.jpg`, dimensions: "10m x 80m", rentPrice: 1800 } },
];

const TEMPLATE_PROJECTS: Array<Partial<Project> & { scene: TemplateScene }> =
  SCENE_TEMPLATES.map(({ eventType, location, scene }) => ({
    name: `${scene.label} Template`,
    client: "Template",
    event: scene.label,
    eventType,
    location,
    status: "Draft",
    thumbnail: sceneThumb(scene.src),
    sceneCount: 1,
    scene,
  }));

// ─── Page Component ───────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading, createProject } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) router.push("/login");
  }, [authLoading, isLoggedIn, router]);

  const handleUseTemplate = async (template: (typeof TEMPLATE_PROJECTS)[number]) => {
    setLoading(true);
    try {
      const { scene, ...projectData } = template;
      await createProject({
        ...projectData,
        name: `${template.name} (from Template)`,
        status: "Draft",
        sceneCount: 1,
        customScenes: [
          { name: scene.label, src: scene.src, width: 4096, height: 2048 },
        ],
        customScenesOnly: true,
      });
      toast.success("Project created from template!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = TEMPLATE_PROJECTS.filter(t => 
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.eventType?.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading || !isLoggedIn) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.push("/dashboard")} 
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
              <ChevronLeft className="w-5 h-5 text-zinc-500" />
            </button>
            <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">Project Templates</h1>
          </div>
          <p className="text-zinc-500 ml-11">Jumpstart your design with pre-configured event layouts</p>
        </div>
      </motion.header>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral-200 transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTemplates.map((template, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group glass-card overflow-hidden hover:shadow-xl transition-all duration-300"
          >
            <div className="aspect-[16/10] relative overflow-hidden bg-zinc-100">
              <img 
                src={template.thumbnail} 
                alt={template.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button 
                  onClick={() => handleUseTemplate(template)}
                  disabled={loading}
                  className="btn-primary py-2 px-6 text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Use Template
                </button>
              </div>
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-600 border border-white/50">
                  {template.eventType}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-zinc-900 text-lg mb-1">{template.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {template.sceneCount} {template.sceneCount === 1 ? "Scene" : "Scenes"} · {template.scene.dimensions}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {template.location}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons "Besides each other" as requested */}
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
                <button 
                  onClick={() => toast.info("Template editing coming soon")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button 
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button 
                  onClick={() => toast.error("Templates cannot be removed in demo mode")}
                  className="flex items-center justify-center w-10 h-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all"
                  title="Remove Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
