import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Game from './pages/Game';
import Recharge from './pages/Recharge';
import Withdraw from './pages/Withdraw';
import Profile from './pages/Profile';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';

function App() {
    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                {/* Public routes */}
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected user routes - requires authentication */}
                <Route path="/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
                <Route path="/recharge" element={<ProtectedRoute><Recharge /></ProtectedRoute>} />
                <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
