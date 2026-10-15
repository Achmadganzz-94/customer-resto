import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ScanTablePage from "./pages/ScanTablePage";
import MenuPage from "./pages/menuPage";
import CartPage from "./pages/cartPage";
import PaymentPage from "./pages/PaymentPage";
import TrackingPage from "./pages/TrackingPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";

import CustomerLayout from "./components/CustomerLayout";
import CustomerSessionWatcher from "./components/CustomerSessionWatcher";
import { CartProvider } from "./context/CartContext";

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <CustomerSessionWatcher />

        <Routes>
          {/* SCAN QR */}
          <Route path="/" element={<ScanTablePage />} />
          <Route path="/scan" element={<ScanTablePage />} />
          <Route path="/table/:tableToken" element={<ScanTablePage />} />

          {/* HALAMAN CUSTOMER */}
          <Route element={<CustomerLayout />}>
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/menu/:tableNumber" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/payment/result" element={<PaymentResultPage />} />
            <Route path="/tracking/:orderId" element={<TrackingPage />} />

            <Route
              path="/orders"
              element={<CustomerOrdersPage mode="active" />}
            />

            <Route
              path="/history"
              element={<CustomerOrdersPage mode="history" />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/scan" replace />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
