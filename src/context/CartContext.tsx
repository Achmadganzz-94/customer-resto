import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { MenuItem } from "../api/menuApi";
import type { CartItem } from "../types/cart";

interface CartContextType {
  items: CartItem[];
  addToCart: (menu: MenuItem) => void;
  removeFromCart: (menuId: string) => void;
  increaseQuantity: (menuId: string) => void;
  decreaseQuantity: (menuId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Tambahkan menu ke keranjang.
  const addToCart = useCallback((menu: MenuItem) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.menu.id === menu.id,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.menu.id === menu.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          menu,
          quantity: 1,
        },
      ];
    });
  }, []);

  // Hapus satu menu dari keranjang.
  const removeFromCart = useCallback((menuId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.menu.id !== menuId),
    );
  }, []);

  // Tambah kuantitas menu.
  const increaseQuantity = useCallback((menuId: string) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.menu.id === menuId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      ),
    );
  }, []);

  // Kurangi kuantitas dan hapus item jika jumlahnya nol.
  const decreaseQuantity = useCallback((menuId: string) => {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.menu.id === menuId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  // Kosongkan keranjang.
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Otomatis kosongkan keranjang saat sesi meja diakhiri.
  useEffect(() => {
    const handleCustomerSessionEnded = () => {
      setItems([]);
    };

    window.addEventListener(
      "customer-session-ended",
      handleCustomerSessionEnded,
    );

    return () => {
      window.removeEventListener(
        "customer-session-ended",
        handleCustomerSessionEnded,
      );
    };
  }, []);

  // Hitung total jumlah menu.
  const totalItems = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  // Hitung total harga keranjang.
  const totalPrice = useMemo(
    () =>
      items.reduce((total, item) => total + item.menu.price * item.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }),
    [
      items,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      totalItems,
      totalPrice,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart harus digunakan di dalam CartProvider");
  }

  return context;
}
