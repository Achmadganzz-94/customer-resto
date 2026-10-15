import { FiArrowLeft, FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const formatRupiah = (value: number) => {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
};

export default function CartPage() {
  const navigate = useNavigate();

  const {
    items,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    totalItems,
    totalPrice,
  } = useCart();

  const tableNumber = localStorage.getItem("customerTableNumber");

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition"
          >
            <FiArrowLeft size={18} />
            Kembali ke Menu
          </button>

          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <span className="text-2xl">🛒</span>
              </div>

              <h1 className="text-xl font-extrabold text-slate-900 mt-5">
                Keranjang Masih Kosong
              </h1>

              <p className="text-sm text-slate-500 mt-2">
                Yuk pilih makanan dan minuman terlebih dahulu.
              </p>

              <button
                type="button"
                onClick={() => navigate("/menu")}
                className="mt-5 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-extrabold hover:bg-blue-700 transition"
              >
                Lihat Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="max-w-2xl mx-auto px-4">
        <header className="pt-5 pb-4">
          <button
            type="button"
            onClick={() => navigate("/menu")}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition"
          >
            <FiArrowLeft size={18} />
            Kembali ke Menu
          </button>

          <div className="flex items-center justify-between gap-3 mt-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
                Restaurant
              </p>

              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
                Keranjang
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                {totalItems} item di keranjang
              </p>
            </div>

            {tableNumber && (
              <div className="shrink-0 rounded-xl bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Meja
                </p>

                <p className="text-xl font-extrabold text-blue-600">
                  {tableNumber}
                </p>
              </div>
            )}
          </div>
        </header>

        <div className="space-y-3">
          {items.map((item) => {
            const itemTotal = item.menu.price * item.quantity;

            return (
              <div
                key={item.menu.id}
                className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                    {item.menu.imageUrl ? (
                      <img
                        src={item.menu.imageUrl}
                        alt={item.menu.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <span className="text-xl">🍽️</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-extrabold text-sm text-slate-900 truncate">
                          {item.menu.name}
                        </h2>

                        <p className="text-xs text-slate-500 mt-1">
                          {formatRupiah(item.menu.price)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.menu.id)}
                        className="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(item.menu.id)}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
                        >
                          <FiMinus size={15} />
                        </button>

                        <span className="w-9 text-center text-sm font-extrabold text-slate-900">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => increaseQuantity(item.menu.id)}
                          className="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition"
                        >
                          <FiPlus size={15} />
                        </button>
                      </div>

                      <p className="text-sm font-extrabold text-slate-900">
                        {formatRupiah(itemTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Total Item</p>

            <p className="text-sm font-bold text-slate-900">{totalItems}</p>
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-base font-extrabold text-slate-900">Total</p>

            <p className="text-lg font-extrabold text-blue-600">
              {formatRupiah(totalPrice)}
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[76px] left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <button
            type="button"
            onClick={() =>
              navigate("/payment", {
                state: {
                  items,
                  totalItems,
                  totalPrice,
                  tableNumber,
                  autoPay: true,
                },
              })
            }
            className="w-full rounded-xl bg-blue-600 text-white py-3.5 text-sm font-extrabold hover:bg-blue-700 transition"
          >
            Lanjutkan ke Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
