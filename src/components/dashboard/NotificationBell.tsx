import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDto } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const NOTIF_TYPE_LABELS: Record<string, string> = {
  CORRECTION_STATUT_CHANGE: "Demande de correction",
  CORRECTION_DECISION: "Décision correction",
  REFERENTIEL_STATUT_CHANGE: "Référentiel projet",
  CONVENTION_STATUT_CHANGE: "Convention",
  CERTIFICAT_STATUT_CHANGE: "Certificat",
  UTILISATION_STATUT_CHANGE: "Utilisation crédit",
};

const NOTIF_TYPE_ROUTES: Record<string, string> = {
  CORRECTION_STATUT_CHANGE: "/dashboard/demandes",
  CORRECTION_DECISION: "/dashboard/demandes",
  REFERENTIEL_STATUT_CHANGE: "/dashboard/referentiels",
  CONVENTION_STATUT_CHANGE: "/dashboard/conventions",
  CERTIFICAT_STATUT_CHANGE: "/dashboard/certificats",
  UTILISATION_STATUT_CHANGE: "/dashboard/utilisations",
};

function NotifItem({ notif, onRead }: { notif: NotificationDto; onRead: (n: NotificationDto) => void }) {
  const timeAgo = notif.createdAt
    ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })
    : "";

  return (
    <button
      onClick={() => onRead(notif)}
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-accent/50 ${
        !notif.read ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {!notif.read && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {NOTIF_TYPE_LABELS[notif.type] || notif.type}
          </p>
          <p className="text-sm text-foreground mt-0.5 line-clamp-2">{notif.message}</p>
          {timeAgo && <p className="text-[11px] text-muted-foreground mt-1">{timeAgo}</p>}
        </div>
      </div>
    </button>
  );
}

export default function NotificationBell() {
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
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune notification
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
