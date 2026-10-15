
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/axios";

type CartItem = {
  menu: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
};

type PaymentState = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  tableNumber: string | null;
};

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PaymentState | null;

  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const checkout = async () => {
      if (!state?.items?.length) {
        setError("Keranjang kosong. Silakan pilih menu kembali.");
        return;
      }

      const sessionToken = localStorage.getItem(
        "customerSessionToken",
      );

      if (!sessionToken) {
        setError(
          "Sesi meja tidak ditemukan. Silakan scan QR meja kembali.",
        );
        return;
      }

      try {
        // 1. Buat pesanan di backend.
        const orderResponse = await api.post(
          "/orders/customer",
          {
            sessionToken,
            orderType: "DINE_IN",
            items: state.items.map((item) => ({
              menuItemId: item.menu.id,
              quantity: item.quantity,
            })),
          },
          {
            headers: {
              "x-session-token": sessionToken,
            },
          },
        );

        const order = orderResponse.data?.data;

        if (!order?.id) {
          throw new Error(
            orderResponse.data?.message ||
              "Pesanan gagal dibuat.",
          );
        }

        // 2. Simpan ID pesanan untuk tracking.
        localStorage.setItem(
          "lastCustomerOrderId",
          order.id,
        );

        // 3. Buat transaksi pembayaran Midtrans.
        const paymentResponse = await api.post(
          "/payments/snap",
          { orderId: order.id },
          {
            headers: {
              "x-session-token": sessionToken,
            },
          },
        );

        const body = paymentResponse.data;
        const payment = body?.data;

        const redirectUrl =
          payment?.redirect_url ??
          payment?.redirectUrl ??
          body?.redirect_url;

        if (
          typeof redirectUrl !== "string" ||
          !redirectUrl.startsWith("https://")
        ) {
          throw new Error(
            body?.message ||
              "URL pembayaran Midtrans tidak tersedia.",
          );
        }

        // 4. Buka halaman pembayaran Midtrans.
        window.location.assign(redirectUrl);
      } catch (err: unknown) {
        console.error("CHECKOUT ERROR:", err);

        if (err && typeof err === "object" && "response" in err) {
          const response = (
            err as {
              response?: {
                data?: { message?: string };
              };
            }
          ).response;

          setError(
            response?.data?.message ||
              "Checkout gagal diproses.",
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Checkout gagal diproses.",
          );
        }
      }
    };

    void checkout();
  }, [state]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-xl font-extrabold text-red-600">
              Checkout Gagal
            </h1>

            <p
              role="alert"
              className="mt-3 text-sm text-slate-600"
            >
              {error}
            </p>

            <button
              type="button"
              onClick={() => navigate("/cart", { replace: true })}
              className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
            >
              Kembali ke Keranjang
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

            <h1 className="mt-5 text-xl font-extrabold text-slate-900">
              Menghubungkan ke Midtrans
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Pesanan sedang diproses. Mohon jangan tutup
              halaman ini.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
