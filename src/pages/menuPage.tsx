import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { io } from "socket.io-client";
import {
  FiCoffee,
  FiGrid,
  FiPackage,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiStar,
  FiX,
  FiShoppingCart,
  FiClipboard,
  FiFileText,
} from "react-icons/fi";
import { getCustomerMenus, type MenuItem } from "../api/menuApi";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

type Category = "SEMUA" | "MAKANAN" | "MINUMAN" | "SNACK" | "DESSERT" | "PAKET";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const formatRupiah = (value: number) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const categoryConfig: Record<
  Exclude<Category, "SEMUA">,
  { label: string; icon: ReactNode }
> = {
  MAKANAN: {
    label: "Makanan",
    icon: <FiShoppingBag size={15} />,
  },
  MINUMAN: {
    label: "Minuman",
    icon: <FiCoffee size={15} />,
  },
  SNACK: {
    label: "Snack",
    icon: <FiGrid size={15} />,
  },
  DESSERT: {
    label: "Dessert",
    icon: <FiStar size={15} />,
  },
  PAKET: {
    label: "Paket",
    icon: <FiPackage size={15} />,
  },
};

const categories: Category[] = [
  "SEMUA",
  "MAKANAN",
  "MINUMAN",
  "SNACK",
  "DESSERT",
  "PAKET",
];

function getCategoryLabel(category: string) {
  if (category in categoryConfig) {
    return categoryConfig[category as Exclude<Category, "SEMUA">].label;
  }

  return category;
}

function getCategoryIcon(category: string) {
  if (category in categoryConfig) {
    return categoryConfig[category as Exclude<Category, "SEMUA">].icon;
  }

  return <FiGrid size={15} />;
}

function MenuImage({ menu }: { menu: MenuItem }) {
  const [imageError, setImageError] = useState(false);

  if (!menu.imageUrl || imageError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0c162b]">
        <FiShoppingBag size={32} className="text-white/15" />
      </div>
    );
  }

  return (
    <img
      src={menu.imageUrl}
      alt={menu.name}
      className="h-full w-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}

function Logo() {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-blue-400/30 bg-[#071126]">
      <img
        src="/logo-restoinnApp.png"
        alt="RestoInnApp"
        className="h-full w-full scale-[1.25] object-cover"
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0a1222]">
      <div className="aspect-[1/0.92] animate-pulse bg-white/5" />

      <div className="space-y-2.5 p-3">
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-white/5" />
        <div className="mt-3 h-8 animate-pulse rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

export default function MenuPage() {
  const navigate = useNavigate();

  const { items, addToCart, totalItems, totalPrice } = useCart();

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("SEMUA");
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);

  const [lastOrderId, setLastOrderId] = useState<string | null>(() =>
    localStorage.getItem("lastCustomerOrderId"),
  );

  const tableNumber = localStorage.getItem("customerTableNumber");

  // ==========================================
  // SINKRONISASI ID PESANAN TERAKHIR
  // ==========================================

  useEffect(() => {
    const syncLastOrder = () => {
      setLastOrderId(localStorage.getItem("lastCustomerOrderId"));
    };

    syncLastOrder();

    window.addEventListener("focus", syncLastOrder);
    window.addEventListener("storage", syncLastOrder);

    return () => {
      window.removeEventListener("focus", syncLastOrder);
      window.removeEventListener("storage", syncLastOrder);
    };
  }, []);

  // ==========================================
  // AMBIL MENU DARI BACKEND
  // ==========================================

  const fetchMenus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getCustomerMenus();

      setMenus(data);
    } catch (err: unknown) {
      console.error("Gagal mengambil menu:", err);

      const message =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: {
                  data?: { message?: string };
                };
              }
            ).response?.data?.message
          : undefined;

      setError(
        typeof message === "string" && message
          ? message
          : "Gagal mengambil data menu.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================
  // SOCKET.IO: UPDATE MENU SECARA REALTIME
  // ==========================================

  useEffect(() => {
    // Ambil data ketika halaman pertama kali dibuka.
    void fetchMenus();

    // Buat koneksi ke Socket.IO backend.
    const socket = io(SOCKET_URL);

    // Jika admin mengubah menu, ambil data terbaru.
    const handleMenuChanged = () => {
      void fetchMenus();
    };

    socket.on("menu:changed", handleMenuChanged);

    // Bersihkan listener dan koneksi saat komponen dilepas.
    return () => {
      socket.off("menu:changed", handleMenuChanged);
      socket.disconnect();
    };
  }, [fetchMenus]);

  // ==========================================
  // TRACKING PESANAN TERAKHIR
  // ==========================================

  const handleOpenLastOrder = () => {
    const orderId = localStorage.getItem("lastCustomerOrderId");

    if (!orderId) {
      setLastOrderId(null);
      return;
    }

    setLastOrderId(orderId);
    navigate(`/tracking/${encodeURIComponent(orderId)}`);
  };

  // ==========================================
  // INVOICE PESANAN TERAKHIR
  // ==========================================

  const handleOpenLastInvoice = () => {
    const orderId = localStorage.getItem("lastCustomerOrderId");

    if (!orderId) {
      setLastOrderId(null);
      return;
    }

    setLastOrderId(orderId);

    navigate(`/tracking/${encodeURIComponent(orderId)}#customer-invoice`);
  };

  // ==========================================
  // FILTER MENU
  // ==========================================

  const filteredMenus = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return menus.filter((menu) => {
      if (menu.isAvailable === false) {
        return false;
      }

      const matchSearch =
        !keyword ||
        menu.name.toLowerCase().includes(keyword) ||
        menu.description?.toLowerCase().includes(keyword);

      const matchCategory = category === "SEMUA" || menu.category === category;

      return matchSearch && matchCategory;
    });
  }, [menus, search, category]);

  // ==========================================
  // KERANJANG
  // ==========================================

  const getQuantity = (menuId: string) =>
    items.find((item) => item.menu.id === menuId)?.quantity || 0;

  const handleAddMenu = (menu: MenuItem) => {
    addToCart(menu);
  };

  return (
    <main className="min-h-dvh bg-[#02060f] text-white">
      <div className="mx-auto min-h-dvh w-full max-w-107.5 overflow-hidden bg-[#050b1a]">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050b1a]/95 px-4 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Logo />

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-300">
                RestoInnApp
              </p>

              <h1 className="mt-1 truncate text-[16px] font-extrabold leading-none text-white">
                Menu
              </h1>
            </div>

            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-white/35">
                Meja
              </p>

              <p className="mt-0.5 text-[16px] font-black leading-none text-blue-300">
                {tableNumber || "—"}
              </p>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="px-4 pb-44">
          {/* WELCOME */}
          <section className="pt-5">
            <p className="text-[11px] font-medium text-white/40">
              Selamat datang 👋
            </p>

            <h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">
              Mau makan apa hari ini?
            </h2>

            <p className="mt-2 text-[11px] leading-5 text-white/45">
              Pilih makanan dan minuman favorit kamu.
            </p>
          </section>

          {/* SEARCH */}
          <section className="pt-4">
            <div className="relative">
              <FiSearch
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari makanan atau minuman..."
                className="h-11 w-full rounded-xl border border-white/8 bg-[#0b1325] pl-10 pr-10 text-xs text-white outline-none placeholder:text-white/25 focus:border-blue-400/40 focus:bg-[#0c162b]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-white/35 transition hover:text-white"
                  aria-label="Hapus pencarian"
                >
                  <FiX size={15} />
                </button>
              )}
            </div>
          </section>

          {/* CATEGORY */}
          <section className="pt-4">
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => {
                const active = category === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[11px] font-bold transition ${
                      active
                        ? "bg-blue-600 text-white shadow-[0_5px_20px_rgba(37,99,235,0.22)]"
                        : "border border-white/7 bg-[#0b1325] text-white/45 hover:text-white"
                    }`}
                  >
                    {item !== "SEMUA" && getCategoryIcon(item)}
                    {item === "SEMUA" ? "Semua" : getCategoryLabel(item)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* TITLE RESULT */}
          {!loading && !error && filteredMenus.length > 0 && (
            <div className="flex items-center justify-between pb-3 pt-5">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {category === "SEMUA" ? "Menu" : getCategoryLabel(category)}
                </h3>

                <p className="mt-0.5 text-[10px] text-white/30">
                  {filteredMenus.length} menu tersedia
                </p>
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="mt-6 rounded-2xl border border-red-400/10 bg-[#0b1222] p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-300">
                <FiShoppingBag size={18} />
              </div>

              <h3 className="mt-3 text-sm font-bold text-white">
                Menu gagal dimuat
              </h3>

              <p className="mt-1 text-[11px] leading-5 text-white/40">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void fetchMenus()}
                className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-[11px] font-bold text-white transition active:scale-95"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && filteredMenus.length === 0 && (
            <div className="mt-6 rounded-2xl border border-white/6 bg-[#0b1222] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/25">
                <FiSearch size={20} />
              </div>

              <h3 className="mt-4 text-sm font-bold text-white">
                Menu tidak ditemukan
              </h3>

              <p className="mt-1 text-[11px] leading-5 text-white/35">
                Coba gunakan kata kunci atau kategori lain.
              </p>
            </div>
          )}

          {/* MENU GRID */}
          {!loading && !error && filteredMenus.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {filteredMenus.map((menu) => {
                const quantity = getQuantity(menu.id);

                return (
                  <article
                    key={menu.id}
                    className="group overflow-hidden rounded-2xl border border-white/6 bg-[#0a1222] shadow-[0_8px_25px_rgba(0,0,0,0.12)]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMenu(menu)}
                      className="relative block aspect-[1/0.92] w-full overflow-hidden bg-[#0c162b]"
                    >
                      <MenuImage menu={menu} />

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                      <div className="absolute left-2.5 top-2.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 backdrop-blur-md">
                        <p className="text-[8px] font-bold uppercase tracking-wide text-white/75">
                          {getCategoryLabel(menu.category)}
                        </p>
                      </div>

                      {quantity > 0 && (
                        <div className="absolute right-2.5 top-2.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-2 text-[10px] font-black text-white shadow-lg">
                          {quantity}
                        </div>
                      )}
                    </button>

                    <div className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMenu(menu)}
                        className="block w-full text-left"
                      >
                        <h3 className="line-clamp-2 min-h-8.5 text-[13px] font-extrabold leading-[1.3] text-white">
                          {menu.name}
                        </h3>

                        {menu.description ? (
                          <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-4 text-white/35">
                            {menu.description}
                          </p>
                        ) : (
                          <div className="h-7" />
                        )}
                      </button>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-extrabold text-blue-300">
                          {formatRupiah(menu.price)}
                        </p>

                        <button
                          type="button"
                          onClick={() => handleAddMenu(menu)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.2)] transition hover:bg-blue-500 active:scale-90"
                          aria-label={`Tambah ${menu.name}`}
                        >
                          <FiPlus size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* FLOATING CART */}
        {totalItems > 0 && (
          <div
            className="fixed left-0 right-0 z-50 mx-auto w-full max-w-107.5 px-4 pt-3"
            style={{
              bottom: "calc(76px + env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="flex w-full items-center gap-3 rounded-2xl border border-blue-400/20 bg-[#0b1a34]/95 px-4 py-3 shadow-[0_15px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl transition active:scale-[0.98]"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <FiShoppingCart size={18} />

                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0b1a34] bg-white px-1 text-[9px] font-black text-blue-600">
                  {totalItems}
                </span>
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-medium text-white/45">
                  Keranjang
                </p>

                <p className="mt-0.5 text-[13px] font-extrabold text-white">
                  {totalItems} item
                </p>
              </div>

              <div className="text-right">
                <p className="text-[9px] font-medium text-white/35">Total</p>

                <p className="mt-0.5 text-[12px] font-extrabold text-blue-300">
                  {formatRupiah(totalPrice)}
                </p>
              </div>

              <div className="ml-1 text-white/50">→</div>
            </button>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <nav
          aria-label="Navigasi utama customer"
          className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-107.5 border-t border-white/10 bg-[#050b1a]/95 px-3 pt-2 backdrop-blur-xl"
          style={{
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-current="page"
              onClick={() => navigate("/menu")}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-blue-500/10 text-blue-300 transition active:scale-95"
            >
              <FiGrid size={20} />
              <span className="text-[10px] font-bold">Menu</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLastOrder}
              disabled={!lastOrderId}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95 ${
                lastOrderId
                  ? "text-white/55 hover:bg-white/5 hover:text-white"
                  : "cursor-not-allowed text-white/20"
              }`}
            >
              <span className="relative">
                <FiClipboard size={20} />

                {lastOrderId && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#050b1a]" />
                )}
              </span>

              <span className="text-[10px] font-semibold">Pesanan Saya</span>
            </button>

            <button
              type="button"
              onClick={handleOpenLastInvoice}
              disabled={!lastOrderId}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95 ${
                lastOrderId
                  ? "text-white/55 hover:bg-white/5 hover:text-white"
                  : "cursor-not-allowed text-white/20"
              }`}
            >
              <FiFileText size={20} />
              <span className="text-[10px] font-semibold">Invoice</span>
            </button>
          </div>
        </nav>

        {/* MENU DETAIL */}
        {selectedMenu && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-107.5 overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#07101f] shadow-2xl">
              <div className="relative">
                <div className="h-57.5 w-full bg-[#0c162b]">
                  <MenuImage menu={selectedMenu} />
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMenu(null)}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-xl"
                  aria-label="Tutup detail menu"
                >
                  <FiX size={17} />
                </button>

                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#07101f] to-transparent" />
              </div>

              <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300">
                  {getCategoryLabel(selectedMenu.category)}
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-white">
                  {selectedMenu.name}
                </h2>

                {selectedMenu.description && (
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    {selectedMenu.description}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-lg font-black text-blue-300">
                    {formatRupiah(selectedMenu.price)}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      handleAddMenu(selectedMenu);
                      setSelectedMenu(null);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-extrabold text-white transition active:scale-95"
                  >
                    <FiPlus size={16} />
                    Tambah
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
