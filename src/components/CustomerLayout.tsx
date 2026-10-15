import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiGrid, FiClipboard, FiClock } from "react-icons/fi";

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuActive =
    location.pathname === "/menu" || location.pathname.startsWith("/menu/");

  const ordersActive =
    location.pathname === "/orders" ||
    location.pathname.startsWith("/tracking/");

  const historyActive = location.pathname === "/history";

  const navItems = [
    {
      label: "Menu",
      icon: FiGrid,
      active: menuActive,
      onClick: () => navigate("/menu"),
    },
    {
      label: "Pesanan",
      icon: FiClipboard,
      active: ordersActive,
      onClick: () => navigate("/orders"),
    },
    {
      label: "Riwayat",
      icon: FiClock,
      active: historyActive,
      onClick: () => navigate("/history"),
    },
  ];

  return (
    <div className="min-h-dvh">
      <div className="pb-[calc(84px+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>

      <nav
        aria-label="Navigasi customer"
        className="fixed bottom-0 left-0 right-0 z-[80] mx-auto w-full max-w-107.5 border-t border-white/10 bg-[#050b1a]/95 px-3 pt-2 backdrop-blur-xl"
        style={{
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                aria-current={item.active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95 ${
                  item.active
                    ? "bg-blue-500/10 text-blue-300"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} />

                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
