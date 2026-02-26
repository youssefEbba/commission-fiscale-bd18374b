import { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { notificationApi, NotificationDto, WS_BASE } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const clientRef = useRef<Client | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        notificationApi.getAll(),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (e) {
      console.error("Erreur chargement notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // WebSocket STOMP connection
  useEffect(() => {
    if (!user) return;

    const client = new Client({
      brokerURL: WS_BASE.replace(/^http/, "ws") + "?token=" + encodeURIComponent(user.token),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/user/${user.userId}`, (message) => {
          try {
            const notif: NotificationDto = JSON.parse(message.body);
            setNotifications((prev) => [notif, ...prev]);
            setUnreadCount((prev) => prev + 1);
          } catch (e) {
            console.error("Erreur parsing notification WS:", e);
          }
        });
      },
      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers["message"]);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Erreur markRead:", e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Erreur markAllRead:", e);
    }
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetchNotifications };
}
