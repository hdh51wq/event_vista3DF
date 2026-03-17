"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Users, DollarSign, Maximize2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Venue, VENUES } from "@/lib/venues";
import { cn } from "@/lib/utils";

export type VenueWithAvailability = Venue & { available: boolean; bookedBy?: string };

export interface VenueSelectorProps {
  projectId: string;
  eventType: string;
  eventDate: string;
  onVenueSelect: (venue: Venue) => void;
  onSkip: () => void;
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden rounded-2xl animate-pulse">
      <div className="aspect-[4/3] bg-zinc-200 dark:bg-zinc-700" />
      <div className="p-5 space-y-3">
        <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
        <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="h-9 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl mt-4" />
      </div>
    </div>
  );
}

export default function VenueSelector({
  projectId,
  eventType,
  eventDate,
  onVenueSelect,
  onSkip,
}: VenueSelectorProps) {
  const { token } = useAuth();
  const [venues, setVenues] = useState<VenueWithAvailability[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateParam = eventDate ? new Date(eventDate).toISOString().slice(0, 10) : "";

  useEffect(() => {
    if (!dateParam || !token) {
      setVenues(VENUES.map((v) => ({ ...v, available: true })));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(
      `/api/venues?date=${encodeURIComponent(dateParam)}&projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized" : "Failed to load venues");
        return r.json();
      })
      .then((data) => {
        setVenues(data.venues ?? VENUES.map((v) => ({ ...v, available: true })));
      })
      .catch((err) => {
        setError(err.message || "Something went wrong");
        setVenues(VENUES.map((v) => ({ ...v, available: true })));
      })
      .finally(() => setLoading(false));
  }, [dateParam, projectId, token]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onSkip()}
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
                Select the room for your {eventType} on {formatEventDate(eventDate)}
              </p>
            </div>
            <button
              onClick={onSkip}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" /> Skip
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : venues && venues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {venues.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "glass-card overflow-hidden rounded-2xl flex flex-col transition-all",
                      !v.available && "opacity-80"
                    )}
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={v.thumbnail}
                        alt={v.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop";
                        }}
                      />
                      <div className="absolute top-3 right-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                            v.available
                              ? "bg-emerald-500/90 text-white"
                              : "bg-red-500/90 text-white"
                          )}
                        >
                          {v.available ? "✓ Available" : "✗ Booked on this date"}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {v.name}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                        <p className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {v.hotel}, {v.location}
                        </p>
                        <p className="flex items-center gap-2">
                          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                          {v.dimensions}
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          Max {v.capacity} guests
                        </p>
                        <p className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                          <DollarSign className="w-3.5 h-3.5 shrink-0" />
                          €{v.pricePerDay.toLocaleString()} / day
                        </p>
                      </div>
                      <button
                        onClick={() => v.available && onVenueSelect(v)}
                        disabled={!v.available}
                        className={cn(
                          "mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all",
                          v.available
                            ? "btn-primary shadow-md hover:shadow-lg"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        Select Venue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                No venues to display.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
