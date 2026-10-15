import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/axios";

type PaymentStatus =
  | "CHECKING"
  | "PAID"
  | "UNPAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "ERROR";

const getPaymentErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: {
      data?: {
        message?: string;
      };
    };
    message?: string;
  };

  return (
    err?.response?.data?.message ||
    err?.message ||
    "Status pembayaran belum dapat diperiksa."
  );
};

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL adalah sumber utama; localStorage sebagai fallback.
  const urlOrderId = searchParams.get("orderId")?.trim() || "";
  const storedOrderId =
    localStorage.getItem("lastCustomerOrderId")?.trim() || "";

  const orderId = urlOrderId || storedOrderId;

  const [status, setStatus] = useState<PaymentStatus>("CHECKING");
  const [message, setMessage] = useState(
    "Sedang memeriksa status pembayaran...",
  );
  const [checking, setChecking] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const checkPayment = useCallback(async () => {
    const sessionToken = localStorage.getItem("customerSessionToken");

    if (!orderId) {
      setStatus("ERROR");
      setMessage(
        "ID pesanan tidak ditemukan. Silakan kembali dan periksa pesanan kamu.",
      );
      setChecking(false);
      return;
    }

    if (!sessionToken) {
      setStatus("ERROR");
      setMessage(
        "Sesi customer tidak ditemukan. Silakan scan QR meja kembali.",
      );
      setChecking(false);
      return;
    }

    setChecking(true);
    setStatus("CHECKING");
    setMessage("Sedang memeriksa status pembayaran...");

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    const check = async () => {
      if (cancelled) return;

      try {
        const response = await api.get(
          `/payments/snap/status/${encodeURIComponent(orderId)}`,
          {
            headers: {
              "x-session-token": sessionToken,
            },
          },
        );

        if (cancelled) return;

        const paymentStatus = response.data?.data?.paymentStatus as
          | PaymentStatus
          | undefined;

        if (
          !paymentStatus ||
          !["PAID", "UNPAID", "FAILED", "EXPIRED", "REFUNDED"].includes(
            paymentStatus,
          )
        ) {
          throw new Error(
            response.data?.message || "Status pembayaran tidak tersedia.",
          );
        }

        setStatus(paymentStatus);

        if (paymentStatus === "PAID") {
          setMessage("Pembayaran berhasil dikonfirmasi. Terima kasih!");
          setChecking(false);
          return;
        }

        if (
          paymentStatus === "FAILED" ||
          paymentStatus === "EXPIRED" ||
          paymentStatus === "REFUNDED"
        ) {
          setMessage(
            paymentStatus === "FAILED"
              ? "Pembayaran gagal. Periksa status pesanan sebelum mencoba pembayaran lagi."
              : paymentStatus === "EXPIRED"
                ? "Transaksi pembayaran sudah kedaluwarsa."
                : "Transaksi pembayaran telah direfund.",
          );
          setChecking(false);
          return;
        }

        attempts += 1;

        if (attempts >= 20) {
          setMessage(
            "Pembayaran belum terkonfirmasi. Periksa kembali beberapa saat lagi.",
          );
          setChecking(false);
          return;
        }

        setMessage(
          "Pembayaran belum terkonfirmasi. Sedang memeriksa kembali...",
        );

        timer = window.setTimeout(() => {
          void check();
        }, 3000);
      } catch (error) {
        if (cancelled) return;

        console.error("CHECK PAYMENT RESULT ERROR:", error);
        attempts += 1;

        const httpStatus = (
          error as {
            response?: {
              status?: number;
            };
          }
        )?.response?.status;

        // Sesi atau kepemilikan pesanan tidak valid.
        if (httpStatus === 401 || httpStatus === 404) {
          setStatus("ERROR");
          setMessage(
            "Sesi atau pesanan tidak dapat diakses. Periksa sesi meja kamu.",
          );
          setChecking(false);
          return;
        }

        if (attempts >= 20) {
          setStatus("ERROR");
          setMessage(getPaymentErrorMessage(error));
          setChecking(false);
          return;
        }

        setMessage("Pemeriksaan sementara gagal. Sedang mencoba kembali...");

        timer = window.setTimeout(() => {
          void check();
        }, 3000);
      }
    };

    void check();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [orderId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      cleanup = await checkPayment();
    })();

    return () => {
      cleanup?.();
    };
  }, [checkPayment, retryKey]);

  const isPaid = status === "PAID";
  const isError =
    status === "ERROR" ||
    status === "FAILED" ||
    status === "EXPIRED" ||
    status === "REFUNDED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            isPaid ? "bg-emerald-100" : isError ? "bg-rose-100" : "bg-amber-100"
          }`}
        >
          {isPaid ? "✅" : isError ? "⚠️" : "⏳"}
        </div>

        <h1 className="text-xl font-bold text-slate-900">
          {isPaid
            ? "Pembayaran Berhasil"
            : isError
              ? "Status Pembayaran"
              : "Memeriksa Pembayaran"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

        {orderId && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-left">
            <p className="text-xs text-slate-500">Nomor pesanan</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-800">
              {orderId}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Status pembayaran</span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isPaid
                  ? "bg-emerald-100 text-emerald-700"
                  : isError
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {status === "CHECKING" ? "MEMERIKSA" : status}
            </span>
          </div>
        </div>

        {orderId && (
          <button
            type="button"
            onClick={() => navigate(`/tracking/${encodeURIComponent(orderId)}`)}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
          >
            Lihat Status Pesanan
          </button>
        )}

        {!checking && (
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-3 w-full rounded-xl border border-slate-200 py-3 font-bold text-slate-700 hover:bg-slate-50"
          >
            Periksa Lagi
          </button>
        )}

        {checking && (
          <p className="mt-4 text-xs text-slate-400">
            Status transaksi diperiksa otomatis. Jangan menganggap pembayaran
            berhasil sampai status PAID terkonfirmasi.
          </p>
        )}
      </section>
    </main>
  );
}
