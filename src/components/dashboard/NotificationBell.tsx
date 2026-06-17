import { Bell, CheckCheck, FileText, FileCheck2, ArrowLeftRight, ClipboardList, AlertCircle, MessageSquare, Settings, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDto } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { fr, arSA } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { tNotificationType } from "@/i18n/enums";

const NOTIF_TYPE_ROUTES: Record<string, (id?: number) => string> = {
  CORRECTION_STATUT_CHANGE: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  CORRECTION_DECISION: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  CORRECTION_REJET_TEMPORAIRE: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  CORRECTION_REJET_TEMP: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  REJET_TEMPORAIRE: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  REFERENTIEL_STATUT_CHANGE: () => "/dashboard/referentiels",
  CONVENTION_STATUT_CHANGE: (id) => (id ? `/dashboard/conventions/${id}` : "/dashboard/conventions"),
  CERTIFICAT_STATUT_CHANGE: (id) => (id ? `/dashboard/certificats/${id}` : "/dashboard/certificats"),
  UTILISATION_STATUT_CHANGE: (id) => (id ? `/dashboard/utilisations/${id}` : "/dashboard/utilisations"),
  TRANSFERT_STATUT_CHANGE: (id) => (id ? `/dashboard/transferts/${id}` : "/dashboard/transferts"),
  MODIFICATION_STATUT_CHANGE: () => "/dashboard/modifications",
  DEMANDE_MISE_EN_PLACE_CHANGE: (id) => (id ? `/dashboard/demandes-mise-en-place/${id}` : "/dashboard/demandes-mise-en-place"),
  GED_DOCUMENT_CHANGE: () => "/dashboard/ged-dossiers",
  DEMANDE_EXPLICATION: () => "/dashboard/demandes",
};

const ENTITY_TYPE_ROUTES: Record<string, (id?: number) => string> = {
  CORRECTION: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  DEMANDE_CORRECTION: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  DEMANDE: (id) => (id ? `/dashboard/demandes/${id}` : "/dashboard/demandes"),
  CONVENTION: (id) => (id ? `/dashboard/conventions/${id}` : "/dashboard/conventions"),
  CERTIFICAT: (id) => (id ? `/dashboard/certificats/${id}` : "/dashboard/certificats"),
  CERTIFICAT_CREDIT: (id) => (id ? `/dashboard/certificats/${id}` : "/dashboard/certificats"),
  UTILISATION: (id) => (id ? `/dashboard/utilisations/${id}` : "/dashboard/utilisations"),
  TRANSFERT: (id) => (id ? `/dashboard/transferts/${id}` : "/dashboard/transferts"),
  MISE_EN_PLACE: (id) => (id ? `/dashboard/demandes-mise-en-place/${id}` : "/dashboard/demandes-mise-en-place"),
  DEMANDE_MISE_EN_PLACE: (id) => (id ? `/dashboard/demandes-mise-en-place/${id}` : "/dashboard/demandes-mise-en-place"),
};

function parsePayload(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

function resolveRoute(notif: NotificationDto): string | null {
  const p = parsePayload(notif.payload);
  if (p && typeof p.redirectPath === "string" && p.redirectPath.startsWith("/")) {
    return p.redirectPath;
  }
  if (notif.type === "DEMANDE_EXPLICATION") {
    if (p) {
      const dossierId = p.dossierId ?? p.dossier_id ?? p.targetId;
      const ctx = String(p.contexte || p.context || "").toUpperCase();
      if (dossierId != null) {
        if (ctx === "CERTIFICAT") return `/dashboard/certificats/${dossierId}`;
        if (ctx === "UTILISATION") return `/dashboard/utilisations/${dossierId}`;
        return `/dashboard/demandes/${dossierId}`;
      }
    }
    return "/dashboard/demandes";
  }
  const byType = NOTIF_TYPE_ROUTES[notif.type];
  if (byType) return byType(notif.entityId);
  const t = String(notif.type || "").toUpperCase();
  if (t.includes("CORRECTION") || t.includes("REJET")) {
    return notif.entityId ? `/dashboard/demandes/${notif.entityId}` : "/dashboard/demandes";
  }
  const ent = (notif.entityType || "").toUpperCase();
  const byEntity = ENTITY_TYPE_ROUTES[ent];
  if (byEntity) return byEntity(notif.entityId);
  if (ent === "CLOTURECREDIT" || ent === "CLOTURE_CREDIT") {
    const cid = p?.certificatCreditId;
    if (cid != null) return `/dashboard/certificats/${cid}`;
  }
  return null;
}

function iconForType(type: string): { Icon: typeof Bell; color: string; bg: string } {
  const t = (type || "").toUpperCase();
  if (t.includes("CERTIFICAT")) return { Icon: FileCheck2, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (t.includes("CORRECTION") || t.includes("DECISION")) return { Icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" };
  if (t.includes("REJET")) return { Icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" };
  if (t.includes("CONVENTION")) return { Icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50" };
  if (t.includes("TRANSFERT")) return { Icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-50" };
  if (t.includes("UTILISATION")) return { Icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50" };
  if (t.includes("MISE_EN_PLACE")) return { Icon: FileCheck2, color: "text-teal-600", bg: "bg-teal-50" };
  if (t.includes("EXPLICATION")) return { Icon: MessageSquare, color: "text-fuchsia-600", bg: "bg-fuchsia-50" };
  if (t.includes("REFERENTIEL") || t.includes("GED")) return { Icon: Settings, color: "text-slate-600", bg: "bg-slate-50" };
  return { Icon: Bell, color: "text-slate-600", bg: "bg-slate-50" };
}

function NotifItem({ notif, onRead }: { notif: NotificationDto; onRead: (n: NotificationDto) => void }) {
  const { i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("ar") ? arSA : fr;
  const timeAgo = notif.createdAt
    ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: dfLocale })
    : "";
  const { Icon, color, bg } = iconForType(notif.type);

  return (
    <button
      onClick={() => onRead(notif)}
      className={`group relative w-full text-start px-3 py-2.5 border-b border-border/60 transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none ${
        !notif.read ? "bg-primary/[0.04]" : ""
      }`}
    >
      {!notif.read && (
        <span className="absolute start-0 top-0 bottom-0 w-0.5 bg-primary" aria-hidden />
      )}
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {tNotificationType(notif.type) || notif.type}
            </p>
            {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          <p className={`text-[13px] leading-snug mt-0.5 line-clamp-2 ${!notif.read ? "font-medium text-foreground" : "text-foreground/85"}`}>
            {notif.message}
          </p>
          {timeAgo && <p className="text-[10.5px] text-muted-foreground mt-1">{timeAgo}</p>}
        </div>
      </div>
    </button>
  );
}

export default function NotificationBell() {
  const { t } = useTranslation("notifications");
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const handleRead = (notif: NotificationDto) => {
    if (!notif.read) markRead(notif.id);
    const route = resolveRoute(notif);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const list = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={t("open_label")}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -end-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 overflow-hidden"
        align="end"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{t("title")}</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 me-1" />
              {t("mark_all_read")}
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex items-center gap-1 px-2 pt-2 pb-1 border-b border-border bg-card">
          {(["all", "unread"] as const).map((key) => {
            const active = tab === key;
            const label = key === "all" ? t("tab_all", { defaultValue: "Toutes" }) : t("tab_unread", { defaultValue: "Non lues" });
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`text-xs h-7 px-3 rounded-md transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/60"
                }`}
              >
                {label}
                {key === "unread" && unreadCount > 0 && (
                  <span className="ms-1.5 text-[10px] opacity-80">({unreadCount})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <ScrollArea className="flex-1 min-h-0">
          {list.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {tab === "unread"
                  ? t("empty_unread", { defaultValue: "Aucune notification non lue" })
                  : t("empty")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {list.map((n) => (
                <NotifItem key={n.id} notif={n} onRead={handleRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
