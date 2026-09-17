import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import RequireRole from './components/RequireRole.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import MenuManager from './pages/admin/MenuManager.jsx';
import RestaurantDetail from './pages/admin/RestaurantDetail.jsx';
import Restaurants from './pages/admin/Restaurants.jsx';
import RevenueHistory from './pages/admin/RevenueHistory.jsx';
import Staff from './pages/admin/Staff.jsx';
import Tables from './pages/admin/Tables.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import CustomerCart from './pages/customer/CustomerCart.jsx';
import CustomerMenu from './pages/customer/CustomerMenu.jsx';
import OrderTracker from './pages/customer/OrderTracker.jsx';
import SessionBill from './pages/customer/SessionBill.jsx';
import KitchenBoard from './pages/kitchen/KitchenBoard.jsx';
import WaiterDashboard from './pages/waiter/WaiterDashboard.jsx';
import Landing from './pages/Landing.jsx';

/** Public `/` renders the marketing landing (no sidebar).
 *  `/r/*` customer ordering also renders standalone (phone-first, no sidebar).
 *  Everything else lives inside the product shell. */
const MANAGERS = ['OWNER', 'MANAGER'];
const ALL_STAFF = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN_STAFF'];

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/r/:slug/t/:table" element={<CustomerMenu />} />
          <Route path="/r/:slug/t/:table/cart" element={<CustomerCart />} />
          <Route path="/r/:slug/t/:table/track/:orderId" element={<OrderTracker />} />
          <Route path="/r/:slug/t/:table/bill" element={<SessionBill />} />
          <Route
            path="/*"
            element={
              <AppShell>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/admin" element={<RequireRole allow={MANAGERS}><AdminHome /></RequireRole>} />
                  <Route path="/admin/revenue" element={<RequireRole allow={MANAGERS}><RevenueHistory /></RequireRole>} />
                  <Route path="/admin/restaurants" element={<RequireRole allow={MANAGERS}><Restaurants /></RequireRole>} />
                  <Route path="/admin/restaurants/:id" element={<RequireRole allow={MANAGERS}><RestaurantDetail /></RequireRole>} />
                  <Route path="/admin/restaurants/:id/menu" element={<RequireRole allow={MANAGERS}><MenuManager /></RequireRole>} />
                  <Route path="/admin/branches/:branchId/tables" element={<RequireRole allow={MANAGERS}><Tables /></RequireRole>} />
                  <Route path="/admin/staff" element={<RequireRole allow={MANAGERS}><Staff /></RequireRole>} />
                  <Route path="/kitchen" element={<RequireRole allow={ALL_STAFF}><KitchenBoard /></RequireRole>} />
                  <Route path="/waiter" element={<RequireRole allow={ALL_STAFF}><WaiterDashboard /></RequireRole>} />
                </Routes>
              </AppShell>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
