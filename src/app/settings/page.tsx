"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  LogOut,
  Building2,
  Save,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Users,
  Armchair,
} from "lucide-react";
import AdminSettingsPanel, { type AdminSettingsTab } from "@/components/AdminSettingsPanel";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type SettingsSection =
  | "profile"
  | "security"
  | "danger"
  | "admin-overview"
  | "admin-users"
  | "admin-scenes"
  | "admin-furniture";

function InputField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder = "",
  rightElement,
}: {
  label: string;
  icon: React.ElementType;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-coral-200 transition-all text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold ${
        type === "success"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
          : "bg-red-50 text-red-700 border border-red-100"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {message}
    </motion.div>
  );
}

export default function SettingsPage() {
  const { user, token, saveProfile, deleteAccount, logout, isLoggedIn, loading, removeCustomFurniture } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const [section, setSection] = useState<SettingsSection>("profile");

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Danger Zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // UI state
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAgencyName(user.agencyName || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/login");
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    if (!isAdmin && section.startsWith("admin-")) setSection("profile");
  }, [isAdmin, section]);

  if (loading || !isLoggedIn) return null;

  const adminTab: AdminSettingsTab =
    section === "admin-overview"
      ? "overview"
      : section === "admin-users"
        ? "users"
        : section === "admin-scenes"
          ? "scenes"
          : section === "admin-furniture"
            ? "furniture"
            : "overview";

  const goAdmin = (t: AdminSettingsTab) => {
    if (t === "overview") setSection("admin-overview");
    else if (t === "users") setSection("admin-users");
    else if (t === "scenes") setSection("admin-scenes");
    else setSection("admin-furniture");
  };

  const NavBtn = ({
    id,
    label,
    icon: Icon,
  }: {
    id: SettingsSection;
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all text-left ${
        section === id
          ? "bg-coral-500/15 text-coral-700 dark:text-coral-300 border border-coral-200/60 dark:border-coral-800/60"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-transparent"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      {label}
    </button>
  );

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await saveProfile({ name, email, agencyName, phone, address });
      showToast(t("settings.profileSaved"), "success");
    } catch (err: any) {
      showToast(err.message || t("settings.failedSaveProfile"), "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast(t("settings.fillAllPasswordFields"), "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t("settings.passwordsDoNotMatch"), "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast(t("settings.passwordMinLength"), "error");
      return;
    }
    setPasswordSaving(true);
    try {
      await saveProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(t("settings.passwordUpdated"), "success");
    } catch (err: any) {
      showToast(err.message || t("settings.failedUpdatePassword"), "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
    } catch (err: any) {
      showToast(err.message || t("settings.failedDeleteAccount"), "error");
      setDeleting(false);
    }
  };

  const handleRemoveCustomFurniture = async (itemId: string) => {
    if (
      !confirm(
        t("settings.confirmRemoveFurniture")
      )
    ) {
      return;
    }
    try {
      const ok = await removeCustomFurniture(itemId);
      if (ok) {
        showToast(t("settings.furnitureRemoved"), "success");
      } else {
        showToast(t("settings.failedRemoveFurniture"), "error");
      }
    } catch (err) {
      console.error("Remove furniture error:", err);
      showToast(t("settings.failedRemoveFurniture"), "error");
    }
  };

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <>
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{t("settings.deleteAccount")}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("settings.actionCannotBeUndone")}</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                {t("settings.deleteAccountWarning")}
              </p>
              <div className="space-y-2 mb-6">
                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  {t("settings.confirmPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t("settings.enterYourPassword")}
                    className="w-full pl-11 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-200 transition-all text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeletePassword(""); }}
                  className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-sm"
                >
                  {t("settings.cancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || deleting}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? t("settings.deleting") : t("settings.deleteAccount")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">{t("settings.title")}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {t("settings.subtitle")}{isAdmin ? t("settings.subtitleAdminSuffix") : ""}.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 space-y-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1 mb-1">{t("settings.account")}</p>
            <NavBtn id="profile" label={t("settings.profile")} icon={User} />
            <NavBtn id="security" label={t("settings.security")} icon={Lock} />
            <NavBtn id="danger" label={t("settings.dangerZone")} icon={AlertTriangle} />
            {isAdmin && (
              <>
                <div className="pt-4 pb-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">{t("settings.admin")}</p>
                </div>
                <NavBtn id="admin-overview" label={t("settings.overview")} icon={BarChart3} />
                <NavBtn id="admin-users" label={t("settings.users")} icon={Users} />
                <NavBtn id="admin-scenes" label={t("settings.scenes")} icon={Building2} />
                <NavBtn id="admin-furniture" label={t("settings.furniture")} icon={Armchair} />
              </>
            )}
            <div className="glass-card p-5 rounded-2xl mt-6 space-y-3">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{t("settings.loggedInAs")}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("settings.logout")}
              </button>
            </div>
          </aside>

          <div className="lg:col-span-9 space-y-6">
            {section.startsWith("admin-") && isAdmin && token ? (
              <AdminSettingsPanel token={token} tab={adminTab} onNavigate={goAdmin} />
            ) : (
              <>
                {section === "profile" && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8 space-y-6"
            >
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <User className="w-5 h-5 text-coral-500" />
                {t("settings.profile")}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label={t("settings.name")} icon={User} value={name} onChange={setName} placeholder={t("settings.yourFullName")} />
                <InputField label={t("settings.email")} icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@agency.com" />
                <InputField label={t("settings.phone")} icon={Phone} type="tel" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" />
                <InputField label={t("settings.agencyName")} icon={Building2} value={agencyName} onChange={setAgencyName} placeholder={t("settings.myAgency")} />
              </div>

              <InputField label={t("settings.address")} icon={MapPin} value={address} onChange={setAddress} placeholder="123 Main St, City, Country" />

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="btn-primary flex items-center gap-2 shadow-lg shadow-coral-100 dark:shadow-none disabled:opacity-60"
                >
                  {profileSaving ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {profileSaving ? t("settings.saving") : t("settings.saveProfile")}
                </button>
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 space-y-4">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <Armchair className="w-4 h-4 text-coral-500" />
                  {t("settings.myCustomFurniture")}
                </h3>
                {(user?.customFurniture?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {user!.customFurniture!.map((item) => (
                      <div
                        key={item.id}
                        className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 group"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomFurniture(item.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                          title={t("settings.removeThisFurniture")}
                        >
                          ✕
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.views.front}
                          alt={item.label}
                          className="w-14 h-14 object-contain"
                        />
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center truncate w-full">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t("settings.noCustomFurniture")}
                  </p>
                )}
              </div>
            </motion.div>
                )}

                {section === "security" && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-8 space-y-6"
            >
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-coral-500" />
                {t("settings.changePassword")}
              </h2>

              <div className="space-y-4">
                <InputField
                  label={t("settings.currentPassword")}
                  icon={Lock}
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder={t("settings.enterCurrentPassword")}
                  rightElement={eyeBtn(showCurrent, () => setShowCurrent(!showCurrent))}
                />
                <InputField
                  label={t("settings.newPassword")}
                  icon={Lock}
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder={t("settings.atLeast6Chars")}
                  rightElement={eyeBtn(showNew, () => setShowNew(!showNew))}
                />
                <InputField
                  label={t("settings.confirmNewPassword")}
                  icon={Lock}
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t("settings.repeatNewPassword")}
                  rightElement={eyeBtn(showConfirm, () => setShowConfirm(!showConfirm))}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  className="btn-primary flex items-center gap-2 shadow-lg shadow-coral-100 dark:shadow-none disabled:opacity-60"
                >
                  {passwordSaving ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {passwordSaving ? t("settings.updating") : t("settings.updatePassword")}
                </button>
              </div>
            </motion.div>
                )}

            {section === "danger" && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border-2 border-red-100 bg-red-50/50 p-8 space-y-4"
            >
              <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t("settings.dangerZone")}
              </h2>
              <p className="text-sm text-red-600/80">
                {t("settings.dangerZoneWarning")}
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl font-semibold hover:bg-red-700 active:scale-95 transition-all text-sm shadow-md shadow-red-200"
              >
                <Trash2 className="w-4 h-4" />
                {t("settings.deleteAccount")}
              </button>
            </motion.div>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
