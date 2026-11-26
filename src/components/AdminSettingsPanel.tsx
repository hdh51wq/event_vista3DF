"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  Building2,
  Armchair,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/uploadImageClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export type AdminSettingsTab = "overview" | "users" | "scenes" | "furniture";

type OverviewStats = {
  totalUsers: number;
  totalProjects: number;
  totalVenues: number;
  totalFurniture: number;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "agency" | "admin";
  projectCount: number;
  createdAt?: string;
};

type AdminVenueRow = {
  _id: string;
  slug: string;
  name: string;
  type: string;
  hotel: string;
  address?: string;
  location: string;
  dimensions: string;
  pricePerDay: number;
  capacity: number;
  eventTypes: string[];
  sceneImageUrl: string;
  description?: string;
  sceneIndex?: number;
};

type AdminFurnitureRow = {
  _id: string;
  id: string;
  label: string;
  price: number;
  defaultWidth: number;
  defaultHeight: number;
  views: {
    front: string;
    back?: string;
    left?: string;
    right?: string;
  };
};

const EVENT_TYPE_OPTIONS = ["Wedding", "Gala Dinner", "Conference"] as const;

/** Approximate byte size of a data URL payload (after compression, for display / limits). */
function dataUrlDecodedBytes(dataUrl: string): number {
  const marker = "base64,";
  const i = dataUrl.indexOf(marker);
  if (i < 0) return Math.ceil(dataUrl.length / 2);
  const b64 = dataUrl.slice(i + marker.length);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const SCENE_IMAGE_MAX_AFTER_COMPRESS = 8 * 1024 * 1024;

function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

async function compressSceneImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX_WIDTH = 2048;
      const w = Math.min(img.width, MAX_WIDTH);
      const h = Math.round((w / Math.max(img.width, 1)) * img.height);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file"));
    };
    img.src = url;
  });
}

function validateSceneImageRatio(dataUrl: string): Promise<{ ok: boolean; ratio: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      const ok = Math.abs(ratio - 2) <= 0.12;
      resolve({ ok, ratio });
    };
    img.onerror = () => resolve({ ok: false, ratio: 0 });
    img.src = dataUrl;
  });
}

type Props = {
  token: string;
  tab: AdminSettingsTab;
  onNavigate: (t: AdminSettingsTab) => void;
};

export default function AdminSettingsPanel({ token, tab, onNavigate }: Props) {
  const { t } = useLanguage();
  const eventTypeLabel = (et: string) =>
    et === "Wedding"
      ? t("admin.eventWedding")
      : et === "Gala Dinner"
        ? t("admin.eventGalaDinner")
        : et === "Conference"
          ? t("admin.eventConference")
          : et;
  const venueTypeLabel = (vt: string) =>
    vt === "Hotel"
      ? t("admin.typeHotel")
      : vt === "Exhibition Space"
        ? t("admin.typeExhibitionSpace")
        : vt;
  const roleLabel = (r: string) => (r === "admin" ? t("admin.roleAdmin") : t("admin.roleAgency"));
  const viewLabel = (k: string) =>
    k === "front"
      ? t("admin.viewFront")
      : k === "back"
        ? t("admin.viewBack")
        : k === "left"
          ? t("admin.viewLeft")
          : t("admin.viewRight");
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"" | "agency" | "admin">("");

  const [venues, setVenues] = useState<AdminVenueRow[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venueSearch, setVenueSearch] = useState("");
  const [venueTypeFilter, setVenueTypeFilter] = useState<"" | "Hotel" | "Exhibition Space">("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [availabilityEventType, setAvailabilityEventType] = useState<
    "Wedding" | "Gala Dinner" | "Conference"
  >("Wedding");
  const [availabilityBySlug, setAvailabilityBySlug] = useState<Record<string, boolean>>({});

  const [furniture, setFurniture] = useState<AdminFurnitureRow[]>([]);
  const [furnitureLoading, setFurnitureLoading] = useState(false);
  const [furnitureSearch, setFurnitureSearch] = useState("");

  const [sceneModal, setSceneModal] = useState<"add" | "edit" | null>(null);
  const [editingVenue, setEditingVenue] = useState<AdminVenueRow | null>(null);
  const [sceneSaving, setSceneSaving] = useState(false);
  const [sceneForm, setSceneForm] = useState({
    type: "Hotel" as "Hotel" | "Exhibition Space",
    name: "",
    address: "",
    hotel: "",
    location: "",
    pricePerDay: 0,
    capacity: 0,
    dimensions: "",
    eventTypes: [] as string[],
    sceneImageUrl: "",
    description: "",
  });
  const [sceneImageError, setSceneImageError] = useState("");
  const [sceneImageCompressionInfo, setSceneImageCompressionInfo] = useState("");
  const [sceneImageSizeWarning, setSceneImageSizeWarning] = useState("");
  const [sceneImageCompressing, setSceneImageCompressing] = useState(false);
  const [sceneImageUploading, setSceneImageUploading] = useState(false);

  const [furnitureModal, setFurnitureModal] = useState<"add" | "edit" | null>(null);
  const [editingFurniture, setEditingFurniture] = useState<AdminFurnitureRow | null>(null);
  const [furnitureForm, setFurnitureForm] = useState({
    id: "",
    label: "",
    price: 0,
    defaultWidth: 100,
    defaultHeight: 100,
    front: "",
    back: "",
    left: "",
    right: "",
  });
  const [furnitureSaving, setFurnitureSaving] = useState(false);
  const [furnitureImageError, setFurnitureImageError] = useState("");
  const [furnitureImageUploading, setFurnitureImageUploading] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.failed"));
      setOverview({
        totalUsers: data.totalUsers,
        totalProjects: data.totalProjects,
        totalVenues: data.totalVenues,
        totalFurniture: data.totalFurniture,
      });
    } catch {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.failed"));
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  const loadVenues = useCallback(async () => {
    setVenuesLoading(true);
    try {
      const res = await fetch("/api/admin/venues", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.failed"));
      setVenues(data.venues || []);
    } catch {
      setVenues([]);
    } finally {
      setVenuesLoading(false);
    }
  }, [token]);

  const loadFurniture = useCallback(async () => {
    setFurnitureLoading(true);
    try {
      const res = await fetch("/api/admin/furniture", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.failed"));
      setFurniture(data.items || []);
    } catch {
      setFurniture([]);
    } finally {
      setFurnitureLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === "overview") loadOverview();
  }, [tab, loadOverview]);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [tab, loadUsers]);

  useEffect(() => {
    if (tab === "scenes") loadVenues();
  }, [tab, loadVenues]);

  useEffect(() => {
    if (tab === "furniture") loadFurniture();
  }, [tab, loadFurniture]);

  useEffect(() => {
    if (tab !== "scenes" || !availabilityDate || !token) return;
    (async () => {
      try {
        const qs = new URLSearchParams({
          date: availabilityDate,
          eventType: availabilityEventType,
        });
        const res = await fetch(`/api/venues?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) return;
        const map: Record<string, boolean> = {};
        for (const v of data.venues || []) {
          map[v.id] = !!v.available;
        }
        setAvailabilityBySlug(map);
      } catch {
        setAvailabilityBySlug({});
      }
    })();
  }, [tab, availabilityDate, availabilityEventType, token]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userRoleFilter && u.role !== userRoleFilter) return false;
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, userSearch, userRoleFilter]);

  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      if (venueTypeFilter && v.type !== venueTypeFilter) return false;
      if (!venueSearch.trim()) return true;
      const q = venueSearch.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.hotel.toLowerCase().includes(q) ||
        v.slug.toLowerCase().includes(q)
      );
    });
  }, [venues, venueSearch, venueTypeFilter]);

  const filteredFurniture = useMemo(() => {
    if (!furnitureSearch.trim()) return furniture;
    const q = furnitureSearch.toLowerCase();
    return furniture.filter((f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
  }, [furniture, furnitureSearch]);

  const openAddScene = () => {
    setEditingVenue(null);
    setSceneForm({
      type: "Hotel",
      name: "",
      address: "",
      hotel: "",
      location: "",
      pricePerDay: 0,
      capacity: 0,
      dimensions: "",
      eventTypes: ["Wedding"],
      sceneImageUrl: "",
      description: "",
    });
    setSceneImageError("");
    setSceneImageCompressionInfo("");
    setSceneImageSizeWarning("");
    setSceneModal("add");
  };

  const openEditScene = (v: AdminVenueRow) => {
    setEditingVenue(v);
    setSceneForm({
      type: (v.type as "Hotel" | "Exhibition Space") || "Hotel",
      name: v.name,
      address: v.address || "",
      hotel: v.hotel,
      location: v.location,
      pricePerDay: v.pricePerDay,
      capacity: v.capacity,
      dimensions: v.dimensions,
      eventTypes: [...(v.eventTypes || [])],
      sceneImageUrl: v.sceneImageUrl,
      description: v.description || "",
    });
    setSceneImageError("");
    setSceneImageCompressionInfo("");
    setSceneImageSizeWarning("");
    setSceneModal("edit");
  };

  const saveScene = async () => {
    if (!sceneForm.name.trim() || !sceneForm.sceneImageUrl) {
      setSceneImageError(t("admin.sceneNameAndImageRequired"));
      return;
    }
    if (!sceneForm.eventTypes.length) {
      setSceneImageError(t("admin.selectAtLeastOneEventType"));
      return;
    }
    if (isDataUrl(sceneForm.sceneImageUrl)) {
      const compressedBytes = dataUrlDecodedBytes(sceneForm.sceneImageUrl);
      if (compressedBytes > SCENE_IMAGE_MAX_AFTER_COMPRESS) {
        setSceneImageSizeWarning(
          t("admin.imageStillTooLarge")
        );
        return;
      }
    }
    setSceneSaving(true);
    setSceneImageError("");
    try {
      if (sceneModal === "add") {
        const res = await fetch("/api/admin/venues", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: sceneForm.name,
            type: sceneForm.type,
            hotel: sceneForm.hotel,
            address: sceneForm.address,
            location: sceneForm.location || sceneForm.hotel,
            dimensions: sceneForm.dimensions,
            pricePerDay: sceneForm.pricePerDay,
            capacity: sceneForm.capacity,
            eventTypes: sceneForm.eventTypes,
            sceneImageUrl: sceneForm.sceneImageUrl,
            description: sceneForm.description,
            sceneIndex: 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("admin.saveFailed"));
      } else if (editingVenue) {
        const res = await fetch(`/api/admin/venues/${editingVenue._id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name: sceneForm.name,
            type: sceneForm.type,
            hotel: sceneForm.hotel,
            address: sceneForm.address,
            location: sceneForm.location || sceneForm.hotel,
            dimensions: sceneForm.dimensions,
            pricePerDay: sceneForm.pricePerDay,
            capacity: sceneForm.capacity,
            eventTypes: sceneForm.eventTypes,
            sceneImageUrl: sceneForm.sceneImageUrl,
            description: sceneForm.description,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("admin.updateFailed"));
      }
      setSceneModal(null);
      await loadVenues();
      await loadOverview();
    } catch (e: unknown) {
      setSceneImageError(e instanceof Error ? e.message : t("admin.saveFailed"));
    } finally {
      setSceneSaving(false);
    }
  };

  const deleteVenue = async (id: string) => {
    if (!confirm(t("admin.confirmDeleteScene"))) return;
    const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE", headers });
    if (res.ok) {
      await loadVenues();
      await loadOverview();
    }
  };

  const patchUserRole = async (id: string, role: "agency" | "admin") => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role }),
    });
    if (res.ok) await loadUsers();
  };

  const deleteUser = async (id: string) => {
    if (!confirm(t("admin.confirmDeleteUser"))) return;
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await loadUsers();
  };

  const openAddFurniture = () => {
    setEditingFurniture(null);
    setFurnitureForm({
      id: "",
      label: "",
      price: 0,
      defaultWidth: 90,
      defaultHeight: 110,
      front: "",
      back: "",
      left: "",
      right: "",
    });
    setFurnitureImageError("");
    setFurnitureModal("add");
  };

  const openEditFurniture = (f: AdminFurnitureRow) => {
    setEditingFurniture(f);
    setFurnitureForm({
      id: f.id,
      label: f.label,
      price: f.price,
      defaultWidth: f.defaultWidth,
      defaultHeight: f.defaultHeight,
      front: f.views.front,
      back: f.views.back || "",
      left: f.views.left || "",
      right: f.views.right || "",
    });
    setFurnitureImageError("");
    setFurnitureModal("edit");
  };

  const onFurniturePng = async (key: "front" | "back" | "left" | "right", file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".png") && file.type !== "image/png") {
      setFurnitureImageError(t("admin.usePngOnly"));
      return;
    }
    setFurnitureImageError("");
    setFurnitureImageUploading(key);
    try {
      const url = await uploadImage(file, "furniture", token);
      setFurnitureForm((prev) => ({ ...prev, [key]: url }));
    } catch (e: unknown) {
      setFurnitureImageError(e instanceof Error ? e.message : t("admin.uploadFailed"));
    } finally {
      setFurnitureImageUploading(null);
    }
  };

  const onSceneImage = async (file: File | null) => {
    if (!file) return;
    const fileType = file.type.toLowerCase();
    if (!fileType.includes("jpeg") && !fileType.includes("jpg") && !fileType.includes("png")) {
      setSceneImageError(t("admin.useJpgOrPng"));
      setSceneImageCompressionInfo("");
      setSceneImageSizeWarning("");
      return;
    }
    setSceneImageCompressing(true);
    setSceneImageUploading(false);
    setSceneImageCompressionInfo("");
    setSceneImageSizeWarning("");
    try {
      const dataUrl = await compressSceneImage(file);
      const originalBytes = file.size;
      const compressedBytes = dataUrlDecodedBytes(dataUrl);
      setSceneImageCompressionInfo(
        `${t("admin.imageCompressed")}: ${formatMb(originalBytes)} → ${formatMb(compressedBytes)} ✓`
      );
      if (compressedBytes > SCENE_IMAGE_MAX_AFTER_COMPRESS) {
        setSceneImageSizeWarning(
          t("admin.imageStillTooLarge")
        );
      } else {
        setSceneImageSizeWarning("");
      }
      const { ok, ratio } = await validateSceneImageRatio(dataUrl);
      if (!ok) {
        setSceneImageError(
          `${t("admin.ratioWarningPrefix")} ${ratio.toFixed(2)}:1${t("admin.ratioWarningSuffix")}`
        );
      } else {
        setSceneImageError("");
      }
      setSceneImageUploading(true);
      const cloudinaryUrl = await uploadImage(dataUrl, "venues", token);
      setSceneForm((prev) => ({ ...prev, sceneImageUrl: cloudinaryUrl }));
      setSceneImageCompressionInfo(
        `${t("admin.uploadedToCloud")}: ${formatMb(originalBytes)} → ${formatMb(compressedBytes)} ✓`
      );
    } catch (e: unknown) {
      setSceneImageError(e instanceof Error ? (e.message === "Could not read image file" ? t("admin.couldNotReadImage") : e.message) : t("admin.couldNotProcessImage"));
      setSceneImageCompressionInfo("");
      setSceneImageSizeWarning("");
    } finally {
      setSceneImageCompressing(false);
      setSceneImageUploading(false);
    }
  };

  const saveFurniture = async () => {
    if (!furnitureForm.label.trim() || !furnitureForm.front) {
      setFurnitureImageError(t("admin.labelAndFrontRequired"));
      return;
    }
    setFurnitureSaving(true);
    setFurnitureImageError("");
    try {
      if (furnitureModal === "add") {
        const id = furnitureForm.id.trim() || furnitureForm.label.toLowerCase().replace(/\s+/g, "-");
        const res = await fetch("/api/admin/furniture", {
          method: "POST",
          headers,
          body: JSON.stringify({
            id,
            label: furnitureForm.label,
            price: furnitureForm.price,
            defaultWidth: furnitureForm.defaultWidth,
            defaultHeight: furnitureForm.defaultHeight,
            views: {
              front: furnitureForm.front,
              back: furnitureForm.back || undefined,
              left: furnitureForm.left || undefined,
              right: furnitureForm.right || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("admin.saveFailed"));
      } else if (editingFurniture) {
        const res = await fetch(`/api/admin/furniture/${encodeURIComponent(editingFurniture.id)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            label: furnitureForm.label,
            price: furnitureForm.price,
            defaultWidth: furnitureForm.defaultWidth,
            defaultHeight: furnitureForm.defaultHeight,
            views: {
              front: furnitureForm.front,
              back: furnitureForm.back || undefined,
              left: furnitureForm.left || undefined,
              right: furnitureForm.right || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("admin.updateFailed"));
      }
      setFurnitureModal(null);
      await loadFurniture();
      await loadOverview();
    } catch (e: unknown) {
      setFurnitureImageError(e instanceof Error ? e.message : t("admin.saveFailed"));
    } finally {
      setFurnitureSaving(false);
    }
  };

  const deleteFurnitureItem = async (catalogId: string) => {
    if (!confirm(t("admin.confirmRemoveFurniture"))) return;
    const res = await fetch(`/api/admin/furniture/${encodeURIComponent(catalogId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await loadFurniture();
      await loadOverview();
    }
  };

  const statCard = (label: string, value: string | number, icon: ReactNode) => (
    <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-coral-500/15 text-coral-600 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {tab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-coral-500" />
              {t("admin.platformOverview")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("admin.keyMetrics")}</p>
          </div>
          {overviewLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("admin.loadingStats")}
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {statCard(t("admin.totalUsers"), overview.totalUsers, <Users className="w-5 h-5" />)}
                {statCard(t("admin.totalProjects"), overview.totalProjects, <BarChart3 className="w-5 h-5" />)}
                {statCard(t("admin.activeVenues"), overview.totalVenues, <Building2 className="w-5 h-5" />)}
                {statCard(t("admin.furnitureItems"), overview.totalFurniture, <Armchair className="w-5 h-5" />)}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onNavigate("scenes")} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> {t("admin.addScene")}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("users")}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {t("admin.manageUsers")}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">{t("admin.couldNotLoadOverview")}</p>
          )}
        </motion.div>
      )}

      {tab === "users" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-coral-500" />
              {t("admin.users")}
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t("admin.searchNameOrEmail")}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as "" | "agency" | "admin")}
                className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">{t("admin.allRoles")}</option>
                <option value="agency">{t("admin.roleAgency")}</option>
                <option value="admin">{t("admin.roleAdmin")}</option>
              </select>
            </div>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            {usersLoading ? (
              <div className="p-8 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {t("admin.loading")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="px-4 py-3 font-semibold">{t("admin.tableName")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableEmail")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableRole")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableProjects")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{u.name}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-xs font-bold",
                              u.role === "admin"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                            )}
                          >
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{u.projectCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                patchUserRole(u.id, e.target.value as "agency" | "admin")
                              }
                              className="text-xs py-1.5 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                            >
                              <option value="agency">{t("admin.roleAgency")}</option>
                              <option value="admin">{t("admin.roleAdmin")}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => deleteUser(u.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title={t("admin.deleteUser")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === "scenes" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-coral-500" />
                {t("admin.scenesAndVenues")}
              </h2>
              <button type="button" onClick={openAddScene} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t("admin.addScene")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  placeholder={t("admin.searchRoomOrHotel")}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                />
              </div>
              <select
                value={venueTypeFilter}
                onChange={(e) =>
                  setVenueTypeFilter(e.target.value as "" | "Hotel" | "Exhibition Space")
                }
                className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">{t("admin.allTypes")}</option>
                <option value="Hotel">{t("admin.typeHotel")}</option>
                <option value="Exhibition Space">{t("admin.typeExhibitionSpace")}</option>
              </select>
              <input
                type="date"
                value={availabilityDate}
                onChange={(e) => setAvailabilityDate(e.target.value)}
                className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
              <select
                value={availabilityEventType}
                onChange={(e) =>
                  setAvailabilityEventType(e.target.value as typeof availabilityEventType)
                }
                className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                {EVENT_TYPE_OPTIONS.map((et) => (
                  <option key={et} value={et}>
                    {eventTypeLabel(et)} ({t("admin.availability")})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-500">
              {t("admin.availabilityHint")}
            </p>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            {venuesLoading ? (
              <div className="p-8 text-center text-zinc-500 text-sm">{t("admin.loadingVenues")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="px-4 py-3 font-semibold">{t("admin.tableRoom")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableType")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableHotel")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tablePricePerDay")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableAvailability")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableEventTypes")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVenues.map((v) => {
                      const avail =
                        availabilityDate && availabilityBySlug[v.slug] !== undefined
                          ? availabilityBySlug[v.slug]
                          : null;
                      return (
                        <tr key={v._id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{v.name}</td>
                          <td className="px-4 py-3">{venueTypeLabel(v.type)}</td>
                          <td className="px-4 py-3">{v.hotel}</td>
                          <td className="px-4 py-3">€{v.pricePerDay.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {avail === null ? (
                              <span className="text-zinc-400">—</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    avail ? "bg-emerald-500" : "bg-red-500"
                                  )}
                                />
                                <span className="text-xs">{avail ? t("admin.available") : t("admin.booked")}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(v.eventTypes || []).map((et) => (
                                <span
                                  key={et}
                                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                >
                                  {eventTypeLabel(et)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEditScene(v)}
                                className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteVenue(v._id)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === "furniture" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Armchair className="w-5 h-5 text-coral-500" />
              {t("admin.furnitureCatalogue")}
            </h2>
            <button
              type="button"
              onClick={openAddFurniture}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t("admin.addFurniture")}
            </button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={furnitureSearch}
              onChange={(e) => setFurnitureSearch(e.target.value)}
              placeholder={t("admin.searchNameOrId")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            {furnitureLoading ? (
              <div className="p-8 text-center text-zinc-500 text-sm">{t("admin.loading")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="px-4 py-3 font-semibold">{t("admin.tableName")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tablePrice")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableDimensions")}</th>
                      <th className="px-4 py-3 font-semibold">{t("admin.tableActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFurniture.map((f) => (
                      <tr key={f._id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                        <td className="px-4 py-3 font-medium">{f.label}</td>
                        <td className="px-4 py-3">€{Number(f.price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {f.defaultWidth} × {f.defaultHeight}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEditFurniture(f)}
                              className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFurnitureItem(f.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Scene modal */}
      {(sceneModal === "add" || sceneModal === "edit") && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {sceneModal === "add" ? t("admin.addScene") : t("admin.editScene")}
            </h3>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldType")}</span>
                <select
                  value={sceneForm.type}
                  onChange={(e) =>
                    setSceneForm((s) => ({ ...s, type: e.target.value as typeof sceneForm.type }))
                  }
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="Hotel">{t("admin.typeHotel")}</option>
                  <option value="Exhibition Space">{t("admin.typeExhibitionSpace")}</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldRoomName")}</span>
                <input
                  value={sceneForm.name}
                  onChange={(e) => setSceneForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldAddress")}</span>
                <input
                  value={sceneForm.address}
                  onChange={(e) => setSceneForm((s) => ({ ...s, address: e.target.value }))}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldHotelName")}</span>
                <input
                  value={sceneForm.hotel}
                  onChange={(e) => setSceneForm((s) => ({ ...s, hotel: e.target.value }))}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldCityLabel")}</span>
                <input
                  value={sceneForm.location}
                  onChange={(e) => setSceneForm((s) => ({ ...s, location: e.target.value }))}
                  placeholder={t("admin.shownOnVenueCards")}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldPricePerDay")}</span>
                  <input
                    type="number"
                    value={sceneForm.pricePerDay || ""}
                    onChange={(e) =>
                      setSceneForm((s) => ({ ...s, pricePerDay: Number(e.target.value) }))
                    }
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldCapacity")}</span>
                  <input
                    type="number"
                    value={sceneForm.capacity || ""}
                    onChange={(e) =>
                      setSceneForm((s) => ({ ...s, capacity: Number(e.target.value) }))
                    }
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldDimensions")}</span>
                <input
                  value={sceneForm.dimensions}
                  onChange={(e) => setSceneForm((s) => ({ ...s, dimensions: e.target.value }))}
                  placeholder={t("admin.dimensionsExample")}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldEventTypes")}</span>
                <div className="flex flex-wrap gap-3 mt-2">
                  {EVENT_TYPE_OPTIONS.map((et) => (
                    <label key={et} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sceneForm.eventTypes.includes(et)}
                        onChange={(e) => {
                          setSceneForm((s) => ({
                            ...s,
                            eventTypes: e.target.checked
                              ? [...s.eventTypes, et]
                              : s.eventTypes.filter((t) => t !== et),
                          }));
                        }}
                      />
                      <span>{eventTypeLabel(et)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldSceneImage")}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={sceneImageCompressing || sceneImageUploading}
                  onChange={(e) => onSceneImage(e.target.files?.[0] ?? null)}
                  className="w-full text-xs disabled:opacity-50"
                />
                {(sceneImageCompressing || sceneImageUploading) && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    {sceneImageUploading ? t("admin.uploadingToCloud") : t("admin.compressingImage")}
                  </p>
                )}
                {!sceneImageCompressing && !sceneImageUploading && sceneImageCompressionInfo && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {sceneImageCompressionInfo}
                  </p>
                )}
                {!sceneImageCompressing &&
                  !sceneImageUploading &&
                  sceneForm.sceneImageUrl &&
                  !sceneImageCompressionInfo && (
                    <p className="text-xs text-zinc-500">{t("admin.currentSceneImage")}</p>
                  )}
                {sceneImageSizeWarning && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {sceneImageSizeWarning}
                  </p>
                )}
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldDescription")}</span>
                <textarea
                  value={sceneForm.description}
                  onChange={(e) => setSceneForm((s) => ({ ...s, description: e.target.value }))}
                  rows={2}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              {sceneImageError && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{sceneImageError}</p>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setSceneModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-semibold text-sm"
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                disabled={Boolean(
                  sceneSaving ||
                    sceneImageCompressing ||
                    sceneImageUploading ||
                    sceneImageSizeWarning ||
                    (!!sceneForm.sceneImageUrl &&
                      isDataUrl(sceneForm.sceneImageUrl) &&
                      dataUrlDecodedBytes(sceneForm.sceneImageUrl) > SCENE_IMAGE_MAX_AFTER_COMPRESS)
                )}
                onClick={saveScene}
                className="flex-1 py-2.5 rounded-xl btn-primary text-sm disabled:opacity-60"
              >
                {sceneSaving ? t("admin.saving") : t("admin.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Furniture modal */}
      {(furnitureModal === "add" || furnitureModal === "edit") && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {furnitureModal === "add" ? t("admin.addFurniture") : t("admin.editFurniture")}
            </h3>
            <div className="space-y-3 text-sm">
              {furnitureModal === "add" && (
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldCatalogueId")}</span>
                  <input
                    value={furnitureForm.id}
                    onChange={(e) => setFurnitureForm((s) => ({ ...s, id: e.target.value }))}
                    placeholder={t("admin.catalogueIdExample")}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldLabel")}</span>
                <input
                  value={furnitureForm.label}
                  onChange={(e) => setFurnitureForm((s) => ({ ...s, label: e.target.value }))}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldPrice")}</span>
                  <input
                    type="number"
                    value={furnitureForm.price || ""}
                    onChange={(e) =>
                      setFurnitureForm((s) => ({ ...s, price: Number(e.target.value) }))
                    }
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldWidth")}</span>
                  <input
                    type="number"
                    value={furnitureForm.defaultWidth || ""}
                    onChange={(e) =>
                      setFurnitureForm((s) => ({ ...s, defaultWidth: Number(e.target.value) }))
                    }
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">{t("admin.fieldHeight")}</span>
                  <input
                    type="number"
                    value={furnitureForm.defaultHeight || ""}
                    onChange={(e) =>
                      setFurnitureForm((s) => ({ ...s, defaultHeight: Number(e.target.value) }))
                    }
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </label>
              </div>
              {(["front", "back", "left", "right"] as const).map((k) => (
                <label key={k} className="block space-y-1">
                  <span className="text-xs font-bold text-zinc-400 uppercase">
                    {viewLabel(k)} (PNG){k === "front" ? " *" : ""}
                  </span>
                  <input
                    type="file"
                    accept="image/png"
                    onChange={(e) => onFurniturePng(k, e.target.files?.[0] ?? null)}
                    className="w-full text-xs"
                  />
                </label>
              ))}
              {furnitureImageError && <p className="text-xs text-red-600">{furnitureImageError}</p>}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setFurnitureModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-semibold text-sm"
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                disabled={furnitureSaving}
                onClick={saveFurniture}
                className="flex-1 py-2.5 rounded-xl btn-primary text-sm disabled:opacity-60"
              >
                {furnitureSaving ? t("admin.saving") : t("admin.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
