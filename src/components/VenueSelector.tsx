"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, DollarSign } from "lucide-react";
import { sceneTemplatesFor, sceneThumb, type TemplateScene } from "@/lib/scenes";

export interface VenueSelectorProps {
  eventType: string;
  eventDate: string;
  onSceneSelect: (scene: TemplateScene) => void;
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Shown right after a project is created. Instead of a venue list, it
// shows the scene templates of the project's event type — one card per
// scene, with the scene's own photo and dimensions. Picking one makes it
// the project's only scene (the same as using a template). There is no
// Skip: the user must choose a scene to continue.
export default function VenueSelector({
  eventType,
  eventDate,
  onSceneSelect,
}: VenueSelectorProps) {
  const templates = sceneTemplatesFor(eventType);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-start justify-between gap-4 p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Choose Your Venue
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Pick the 360° scene for your {eventType}
                {eventDate ? ` on ${formatEventDate(eventDate)}` : ""} — each one is a single-scene template
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {templates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map((t) => (
                  <div
                    key={t.scene.label}
                    className="glass-card overflow-hidden rounded-2xl flex flex-col transition-all"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={sceneThumb(t.scene.src)}
                        alt={t.scene.label}
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-600 border border-white/50">
                          {t.eventType}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {t.scene.label}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                        <p className="flex items-center gap-2">
                          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                          1 Scene · {t.scene.dimensions}
                        </p>
                        <p className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                          <DollarSign className="w-3.5 h-3.5 shrink-0" />
                          €{t.scene.rentPrice.toLocaleString()} / day
                        </p>
                      </div>
                      <button
                        onClick={() => onSceneSelect(t.scene)}
                        className="mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all btn-primary shadow-md hover:shadow-lg"
                      >
                        Select Scene
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                No scenes to display for this event type.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
