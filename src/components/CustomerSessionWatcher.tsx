import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const SESSION_TOKEN_KEY = "customerSessionToken";
const TABLE_NUMBER_KEY = "customerTableNumber";
const TABLE_ID_KEY = "customerTableId";
const SESSION_ID_KEY = "customerSessionId";

interface TableSocketEvent {
  tableId?: string;
  tableNumber?: number;
  isOccupied?: boolean;
  occupancyStatus?: string;
  status?: string;
}

interface SessionResponse {
  success: boolean;
  data?: {
    status?: string;
    sessionToken?: string;
  };
}

function clearCustomerSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(TABLE_NUMBER_KEY);
  localStorage.removeItem(TABLE_ID_KEY);
  localStorage.removeItem(SESSION_ID_KEY);

  // Memberi tahu CartProvider bahwa sesi telah diakhiri.
  window.dispatchEvent(new CustomEvent("customer-session-ended"));
}

export default function CustomerSessionWatcher() {
  const navigate = useNavigate();
  const checkingRef = useRef(false);
  const endingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const redirectToScan = () => {
      if (!mounted || endingRef.current) return;

      endingRef.current = true;
      clearCustomerSession();

      navigate("/scan", {
        replace: true,
        state: { sessionEnded: true },
      });
    };

    // Cadangan jika Socket.IO terputus atau event terlewat.
    const checkCurrentSession = async () => {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);

      if (!token || checkingRef.current || endingRef.current) {
        return;
      }

      checkingRef.current = true;

      try {
        const response = await api.get<SessionResponse>(
          `/customer-sessions/${encodeURIComponent(token)}`,
        );

        if (!mounted || endingRef.current) return;

        if (
          !response.data?.success ||
          response.data.data?.status !== "ACTIVE"
        ) {
          redirectToScan();
        }
      } catch (error: any) {
        if (!mounted || endingRef.current) return;

        const status = error?.response?.status;

        // Status ini menandakan sesi tidak valid atau sudah berakhir.
        if ([400, 401, 404].includes(status)) {
          redirectToScan();
        } else {
          // Jangan menghapus sesi jika server hanya sedang terputus.
          console.error(
            "Gagal memeriksa sesi customer:",
            error?.message || error,
          );
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const socket = io(SOCKET_URL);

    const handleTableAvailable = (event: TableSocketEvent) => {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);

      // Tidak ada sesi customer yang sedang digunakan.
      if (!token || endingRef.current) return;

      // Abaikan event yang justru menyatakan meja masih terisi.
      if (
        event.isOccupied === true ||
        event.occupancyStatus === "OCCUPIED" ||
        event.status === "OCCUPIED"
      ) {
        return;
      }

      const storedTableId = localStorage.getItem(TABLE_ID_KEY);
      const storedTableNumber = localStorage.getItem(TABLE_NUMBER_KEY);

      const matchesTableId =
        Boolean(event.tableId) &&
        Boolean(storedTableId) &&
        event.tableId === storedTableId;

      const matchesTableNumber =
        event.tableNumber != null &&
        storedTableNumber != null &&
        String(event.tableNumber) === storedTableNumber;

      // Jangan mengeluarkan customer yang sedang duduk di meja lain.
      if (!matchesTableId && !matchesTableNumber) return;

      redirectToScan();
    };

    socket.on("table:available", handleTableAvailable);

    void checkCurrentSession();

    const interval = window.setInterval(() => {
      void checkCurrentSession();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      socket.off("table:available", handleTableAvailable);
      socket.disconnect();
    };
  }, [navigate]);

  return null;
}
