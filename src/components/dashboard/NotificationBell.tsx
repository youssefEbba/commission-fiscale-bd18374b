import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDto } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { fr, arSA } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { tNotificationType } from "@/i18n/enums";

const NOTIF_TYPE_ROUTES: Record<string, string> = {
  CORRECTION_STATUT_CHANGE: "/dashboard/demandes",
  CORRECTION_DECISION: "/dashboard/demandes",
  REFERENTIEL_STATUT_CHANGE: "/dashboard/referentiels",
  CONVENTION_STATUT_CHANGE: "/dashboard/conventions",
  CERTIFICAT_STATUT_CHANGE: "/dashboard/certificats",
  UTILISATION_STATUT_CHANGE: "/dashboard/utilisations",
  TRANSFERT_STATUT_CHANGE: "/dashboard/transferts",
  MODIFICATION_STATUT_CHANGE: "/dashboard/modifications",
  DEMANDE_MISE_EN_PLACE_CHANGE: "/dashboard/demandes-mise-en-place",
  GED_DOCUMENT_CHANGE: "/dashboard/ged-dossiers",
};

function NotifItem({ notif, onRead }: { notif: NotificationDto; onRead: (n: NotificationDto) => void }) {
  const { i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("ar") ? arSA : fr;
  const timeAgo = notif.createdAt
    ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: dfLocale })
    : "";

  return (
    <button
      onClick={() => onRead(notif)}
      className={`w-full text-start px-4 py-3 border-b border-border transition-colors hover:bg-accent/50 ${
        !notif.read ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {!notif.read && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {tNotificationType(notif.type) || notif.type}
          </p>
          <p className="text-sm text-foreground mt-0.5 line-clamp-2">{notif.message}</p>
          {timeAgo && <p className="text-[11px] text-muted-foreground mt-1">{timeAgo}</p>}
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

  const handleRead = (notif: NotificationDto) => {
    if (!notif.read) markRead(notif.id);
    const route = NOTIF_TYPE_ROUTES[notif.type];
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

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
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">{t("title")}</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 me-1" />
              {t("mark_all_read")}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            notifications.map((n) => (
              <NotifItem key={n.id} notif={n} onRead={handleRead} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
