import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiClock, FiFileText, FiRefreshCw } from "react-icons/fi";
import { api } from "../api/axios";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  menuItem?: {
    name: string;
  };
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  createdAt: string;
  orderItems: OrderItem[];
};

type Props = {
  mode: "active" | "history";
};

const formatRupiah = (value: number) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatDate = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const isFinished = (status: string) =>
  status === "COMPLETED" || status === "CANCELLED";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string };
        };
      }
    ).response;

    return response?.data?.message ?? "Gagal memuat pesanan.";
  }

  return "Tidak dapat terhubung ke backend.";
}

function clearCustomerSession() {
  localStorage.removeItem("customerSessionToken");
  localStorage.removeItem("customerSessionId");
  localStorage.removeItem("customerTableId");
  localStorage.removeItem("customerTableNumber");

  // Reset state keranjang melalui CartContext.
  window.dispatchEvent(new Event("customer-session-ended"));
}

export default function CustomerOrdersPage({ mode }: Props) {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    let redirecting = false;
    let timer: number | undefined;

    const returnToScan = (message?: string) => {
      if (!mounted || redirecting) return;

      redirecting = true;

      // Jangan biarkan data sesi sebelumnya tertinggal di UI.
      setOrders([]);
      setError(message || "");
      setLoading(false);

      clearCustomerSession();

      navigate("/scan", {
        replace: true,
        state: { sessionEnded: true },
      });
    };

    const handleSessionEnded = () => {
      returnToScan("Sesi meja sudah berakhir.");
    };

    window.addEventListener("customer-session-ended", handleSessionEnded);

    const loadOrders = async () => {
      const sessionToken = localStorage.getItem("customerSessionToken");

      if (!sessionToken) {
        returnToScan("Sesi meja tidak ditemukan. Silakan scan QR kembali.");
        return;
      }

      try {
        const response = await api.get("/orders/customer-session/orders", {
          headers: {
            "x-session-token": sessionToken,
          },
        });

        if (!mounted || redirecting) return;

        const data = response.data?.data?.orders ?? response.data?.data;

        if (!Array.isArray(data)) {
          throw new Error("Format daftar pesanan dari backend tidak sesuai.");
        }

        setOrders(data as CustomerOrder[]);
        setError("");
      } catch (err: unknown) {
        if (!mounted || redirecting) return;

        const status = (
          err as {
            response?: {
              status?: number;
            };
          }
        )?.response?.status;

        // Sesi tidak valid atau sudah diakhiri.
        if ([400, 401, 404].includes(status ?? 0)) {
          returnToScan("Sesi meja sudah berakhir. Silakan scan QR kembali.");
          return;
        }

        // Kesalahan jaringan tidak langsung menghapus sesi.
        setError(getErrorMessage(err));
      } finally {
        if (mounted && !redirecting) {
          setLoading(false);
        }
      }

      if (mounted && !redirecting) {
        timer = window.setTimeout(() => {
          void loadOrders();
        }, 5000);
      }
    };

    void loadOrders();

    return () => {
      mounted = false;

      window.removeEventListener("customer-session-ended", handleSessionEnded);

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [retry, navigate]);

  const visibleOrders =
    mode === "active"
      ? orders.filter((order) => !isFinished(order.status))
      : orders.filter((order) => isFinished(order.status));

  const openTracking = (orderId: string) => {
    navigate(`/tracking/${encodeURIComponent(orderId)}`);
  };

  const openInvoice = (orderId: string) => {
    navigate(`/tracking/${encodeURIComponent(orderId)}#customer-invoice`);
  };

  return (
    <main className="min-h-dvh bg-[#02060f] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            RestoInnApp
          </p>

          <h1 className="mt-2 text-2xl font-extrabold">
            {mode === "active" ? "Pesanan Saya" : "Riwayat Pesanan"}
          </h1>

          <p className="mt-2 text-xs leading-5 text-white/45">
            {mode === "active"
              ? "Pesanan yang masih diproses akan muncul di sini."
              : "Lihat pesanan selesai selama sesi meja ini masih aktif."}
          </p>
        </header>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-white/45">
            {loading ? "Memuat pesanan..." : `${visibleOrders.length} pesanan`}
          </p>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
          >
            <FiRefreshCw size={14} />
            Perbarui
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRetry((value) => value + 1);
              }}
              className="mt-3 font-bold"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && visibleOrders.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0a1222] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/40">
              <FiClock size={22} />
            </div>

            <h2 className="mt-4 font-bold">
              {mode === "active"
                ? "Belum ada pesanan aktif"
                : "Riwayat masih kosong"}
            </h2>

            <p className="mt-2 text-xs leading-5 text-white/45">
              {mode === "active"
                ? "Pesanan yang selesai akan dipindahkan ke riwayat."
                : "Pesanan selesai dan dibatalkan akan muncul di sini."}
            </p>

            {mode === "active" && (
              <button
                type="button"
                onClick={() => navigate("/menu")}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white"
              >
                Lihat Menu
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-white/10 bg-[#0a1222] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-white/40">Nomor pesanan</p>

                  <p className="mt-1 break-all text-sm font-extrabold">
                    {order.orderNumber || order.id}
                  </p>

                  <p className="mt-1 text-[10px] text-white/40">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      order.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : order.status === "CANCELLED"
                          ? "bg-rose-500/10 text-rose-300"
                          : "bg-blue-500/10 text-blue-300"
                    }`}
                  >
                    {order.status}
                  </span>

                  <p
                    className={`mt-2 text-[10px] font-bold ${
                      order.paymentStatus === "PAID"
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  >
                    {order.paymentStatus === "PAID"
                      ? "SUDAH DIBAYAR"
                      : order.paymentStatus}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
                {order.orderItems?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 text-xs"
                  >
                    <span className="text-white/60">
                      {item.menuItem?.name ?? "Menu"} × {item.quantity}
                    </span>

                    <span className="text-white/50">
                      {formatRupiah(Number(item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div>
                  <p className="text-[10px] text-white/40">Total</p>
                  <p className="mt-1 text-sm font-extrabold text-blue-300">
                    {formatRupiah(order.totalPrice)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openTracking(order.id)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold text-white/70 hover:bg-white/5"
                  >
                    Detail
                  </button>

                  {mode === "history" && (
                    <button
                      type="button"
                      onClick={() => openInvoice(order.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-500"
                    >
                      <FiFileText size={13} />
                      Invoice
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
