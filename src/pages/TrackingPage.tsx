import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/axios";

type OrderItem = {
  id?: string;
  quantity: number;
  name?: string;
  price?: number;
  notes?: string | null;
  menuItem?: {
    name: string;
  };
};

type Order = {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  discount?: number;
  createdAt?: string;
  orderItems?: OrderItem[];
};

const steps = [
  { status: "PENDING", label: "Pesanan diterima" },
  { status: "PREPARING", label: "Sedang disiapkan" },
  { status: "READY", label: "Pesanan siap" },
  { status: "SERVED", label: "Pesanan disajikan" },
  { status: "COMPLETED", label: "Pesanan selesai" },
];

const formatRupiah = (value: number) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const formatDate = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function getErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (
      err as {
        response?: {
          status?: number;
          data?: { message?: string };
        };
      }
    ).response;

    console.error("TRACKING API ERROR:", response);

    if (response?.status === 401) {
      return "Sesi meja tidak valid atau sudah berakhir. Silakan scan QR meja kembali.";
    }

    if (response?.status === 404) {
      return (
        response.data?.message ?? "Pesanan tidak ditemukan. Periksa ID pesanan."
      );
    }

    return (
      response?.data?.message ??
      `Gagal memuat pesanan (${response?.status ?? "error"}).`
    );
  }

  console.error("TRACKING NETWORK ERROR:", err);

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Tidak dapat terhubung ke backend. Periksa server dan URL API.";
}

export default function TrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const invoiceScrollKey = useRef<string | null>(null);

  const goToMenu = () => {
    navigate("/menu");
  };

  const showInvoice = () => {
    document.getElementById("customer-invoice")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const showTracking = () => {
    document.getElementById("tracking-status")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Ambil data pesanan. Polling tidak bergantung pada state order,
  // sehingga perubahan order tidak menyebabkan request berulang tanpa jeda.
  useEffect(() => {
    let active = true;
    let continuePolling = true;
    let timer: number | undefined;

    const fetchOrder = async (): Promise<void> => {
      if (!orderId) {
        setError("ID pesanan tidak ditemukan di URL.");
        setLoading(false);
        continuePolling = false;
        return;
      }

      const sessionToken = localStorage.getItem("customerSessionToken");

      if (!sessionToken) {
        setError(
          "Token sesi meja tidak ditemukan. Silakan scan QR meja kembali.",
        );
        setLoading(false);
        continuePolling = false;
        return;
      }

      try {
        const response = await api.get(
          `/orders/customer/${encodeURIComponent(orderId)}`,
          {
            headers: {
              "x-session-token": sessionToken,
            },
          },
        );

        if (!active) return;

        const data = response.data?.data?.order ?? response.data?.data;

        if (!data || typeof data.status !== "string") {
          console.error("TRACKING RESPONSE FORMAT:", response.data);

          throw new Error("Format data pesanan dari backend tidak sesuai.");
        }

        setOrder(data as Order);
        setError("");
      } catch (err: unknown) {
        if (!active) return;

        setError(getErrorMessage(err));

        // Hentikan polling untuk error yang kemungkinan permanen.
        // Customer tetap dapat menekan tombol "Coba lagi".
        if (typeof err === "object" && err !== null && "response" in err) {
          const status = (
            err as {
              response?: { status?: number };
            }
          ).response?.status;

          if (status === 401 || status === 404) {
            continuePolling = false;
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const poll = async () => {
      await fetchOrder();

      if (!active || !continuePolling) return;

      // Request berikutnya baru dimulai setelah request saat ini selesai.
      timer = window.setTimeout(() => {
        void poll();
      }, 5000);
    };

    void poll();

    return () => {
      active = false;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [orderId, retry]);

  // Bila customer membuka /tracking/:orderId#customer-invoice,
  // gulir ke invoice setelah data berhasil dimuat.
  // Gunakan key agar polling tidak membuat halaman bergulir lagi.
  useEffect(() => {
    if (location.hash !== "#customer-invoice" || !orderId || !order) {
      return;
    }

    const key = `${orderId}#customer-invoice`;

    if (invoiceScrollKey.current === key) {
      return;
    }

    const timer = window.setTimeout(() => {
      const invoice = document.getElementById("customer-invoice");

      if (invoice) {
        invoice.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        invoiceScrollKey.current = key;
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash, orderId, order]);

  const currentIndex = steps.findIndex((step) => step.status === order?.status);

  const calculatedSubtotal =
    order?.orderItems?.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    ) ?? 0;

  const subtotal = Number(order?.subtotal ?? calculatedSubtotal);
  const tax = Number(order?.tax ?? 0);
  const serviceCharge = Number(order?.serviceCharge ?? 0);
  const discount = Number(order?.discount ?? 0);

  const paymentIsPaid = order?.paymentStatus === "PAID";

  const paymentIsFailed =
    order?.paymentStatus === "FAILED" ||
    order?.paymentStatus === "EXPIRED" ||
    order?.paymentStatus === "REFUNDED";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-12 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        {/* NAVIGASI CUSTOMER */}
        <nav
          aria-label="Navigasi customer"
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="px-2">
              <p className="text-lg font-extrabold text-slate-900">
                Restaurant
              </p>
              <p className="text-xs text-slate-500">Customer Area</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goToMenu}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Menu
              </button>

              <button
                type="button"
                onClick={showTracking}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-900"
              >
                Tracking
              </button>

              <button
                type="button"
                onClick={showInvoice}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Invoice
              </button>
            </div>
          </div>
        </nav>

        {/* STATUS PESANAN */}
        <section
          id="tracking-status"
          className="mb-6 scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:hidden"
        >
          <div className="mb-6">
            <button
              type="button"
              onClick={goToMenu}
              className="mb-5 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Kembali ke Menu
            </button>

            <h1 className="text-2xl font-extrabold text-slate-900">
              Tracking Pesanan
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Pantau perkembangan pesanan kamu di sini.
            </p>
          </div>

          {loading && !order ? (
            <p className="py-10 text-center text-slate-500">
              Memuat status pesanan...
            </p>
          ) : error && !order ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-700">
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
          ) : order ? (
            <>
              {error && (
                <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                  <p>Pembaruan status gagal: {error}</p>

                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setRetry((value) => value + 1);
                    }}
                    className="mt-2 font-bold"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Nomor pesanan</p>

                <p className="mt-1 break-all font-extrabold text-slate-900">
                  {order.orderNumber || order.id}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Pembayaran</span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      paymentIsPaid
                        ? "bg-emerald-100 text-emerald-700"
                        : paymentIsFailed
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {paymentIsPaid ? "Sudah dibayar" : order.paymentStatus}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Total pesanan</span>

                  <span className="font-extrabold text-slate-900">
                    {formatRupiah(order.totalPrice)}
                  </span>
                </div>
              </div>

              <h2 className="mb-6 mt-8 font-bold text-slate-900">
                Status pesanan
              </h2>

              {order.status === "CANCELLED" ? (
                <p className="rounded-xl bg-rose-50 p-4 font-semibold text-rose-700">
                  Pesanan dibatalkan.
                </p>
              ) : (
                <div className="space-y-0">
                  {steps.map((step, index) => {
                    const completed =
                      currentIndex >= 0 && index <= currentIndex;

                    const current = index === currentIndex;
                    const last = index === steps.length - 1;

                    return (
                      <div
                        key={step.status}
                        className={`relative flex gap-4 ${last ? "" : "pb-7"}`}
                      >
                        {/* GARIS DAN TITIK */}
                        <div className="relative flex w-4 shrink-0 justify-center self-stretch">
                          {!last && (
                            <div
                              className={`absolute bottom-0 left-1/2 top-3 w-0.5 -translate-x-1/2 ${
                                index < currentIndex
                                  ? "bg-emerald-500"
                                  : "bg-slate-200"
                              }`}
                            />
                          )}

                          <div
                            className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                              completed
                                ? "border-emerald-600 bg-emerald-500"
                                : "border-slate-300 bg-white"
                            } ${current ? "ring-4 ring-emerald-100" : ""}`}
                          />
                        </div>

                        <div className="min-w-0 flex-1 pb-1">
                          <p
                            className={`font-bold ${
                              completed ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            {step.label}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {current
                              ? "Status saat ini"
                              : completed
                                ? "Selesai"
                                : "Menunggu"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* NAVIGASI AKSI */}
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={goToMenu}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Lihat Menu
                </button>

                <button
                  type="button"
                  onClick={goToMenu}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Pesan Lagi
                </button>

                <button
                  type="button"
                  onClick={showInvoice}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:col-span-2"
                >
                  Lihat Invoice
                </button>
              </div>

              <p className="mt-5 text-center text-xs text-slate-400">
                Status diperbarui otomatis setiap 5 detik.
              </p>
            </>
          ) : null}
        </section>

        {/* INVOICE */}
        {order && (
          <section
            id="customer-invoice"
            className="scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none"
          >
            <div className="flex flex-col gap-4 border-b border-dashed border-slate-300 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Bukti Transaksi
                </p>

                <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
                  Invoice
                </h2>

                <p className="mt-1 break-all text-sm text-slate-500">
                  {order.orderNumber || order.id}
                </p>
              </div>

              <div className="sm:text-right">
                <p className="text-sm font-bold text-slate-900">Restaurant</p>

                <p className="mt-1 text-xs text-slate-500">
                  Tanggal: {formatDate(order.createdAt)}
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                    paymentIsPaid
                      ? "bg-emerald-100 text-emerald-700"
                      : paymentIsFailed
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                  } print:border print:border-slate-300 print:bg-white print:text-black`}
                >
                  {paymentIsPaid ? "LUNAS" : order.paymentStatus}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 font-bold text-slate-900">Rincian Pesanan</h3>

              {order.orderItems?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-3 pr-2 font-semibold">Menu</th>
                        <th className="px-2 py-3 text-center font-semibold">
                          Qty
                        </th>
                        <th className="px-2 py-3 text-right font-semibold">
                          Harga
                        </th>
                        <th className="py-3 pl-2 text-right font-semibold">
                          Jumlah
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {order.orderItems.map((item, index) => {
                        const price = Number(item.price || 0);
                        const lineTotal = price * item.quantity;

                        return (
                          <tr
                            key={item.id ?? index}
                            className="border-b border-slate-100"
                          >
                            <td className="py-3 pr-2 text-slate-700">
                              <p className="font-medium">
                                {item.menuItem?.name ?? item.name ?? "Menu"}
                              </p>

                              {item.notes && (
                                <p className="mt-1 text-xs text-slate-400">
                                  Catatan: {item.notes}
                                </p>
                              )}
                            </td>

                            <td className="px-2 py-3 text-center text-slate-600">
                              {item.quantity}
                            </td>

                            <td className="px-2 py-3 text-right text-slate-600">
                              {formatRupiah(price)}
                            </td>

                            <td className="py-3 pl-2 text-right font-semibold text-slate-800">
                              {formatRupiah(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Rincian item tidak tersedia.
                </p>
              )}
            </div>

            <div className="ml-auto mt-6 max-w-sm space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-slate-600">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>

              {tax !== 0 && (
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Pajak</span>
                  <span>{formatRupiah(tax)}</span>
                </div>
              )}

              {serviceCharge !== 0 && (
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Biaya layanan</span>
                  <span>{formatRupiah(serviceCharge)}</span>
                </div>
              )}

              {discount !== 0 && (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Diskon</span>
                  <span>- {formatRupiah(discount)}</span>
                </div>
              )}

              <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-base font-extrabold text-slate-900">
                <span>Total</span>
                <span>{formatRupiah(order.totalPrice)}</span>
              </div>

              <div className="flex justify-between gap-4 text-xs text-slate-500">
                <span>Status pembayaran</span>
                <span>{order.paymentStatus}</span>
              </div>
            </div>

            <div className="mt-8 border-t border-dashed border-slate-300 pt-5 text-center">
              <p className="font-semibold text-slate-700">
                Terima kasih sudah berkunjung!
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Simpan invoice ini sebagai bukti transaksi.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                Cetak / Simpan PDF
              </button>

              <button
                type="button"
                onClick={goToMenu}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Pesan Lagi
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
