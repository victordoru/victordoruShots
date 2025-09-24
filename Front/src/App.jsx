import "./css/style.css";

// src/App.jsx

import PropTypes from 'prop-types';
import { useLocation } from "react-router-dom";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import DefaultLayout from "@/components/DefaultLayout";
import AuthLayout from "@/components/AuthLayout";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import Home from "@/pages/Home";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import ResetPassword from "@/pages/auth/ResetPassword";
import SendResetPassword from "@/pages/auth/SendResetPassword";
import ConfirmEmail from "@/pages/auth/ConfirmEmail";
import Profile from "@/pages/profile/ProfilePage";
import ContentManagement from "@/pages/profile/ContentManagement";
import OrdersManagement from "@/pages/profile/OrdersManagement";
import PhotoDetail from "@/pages/PhotoDetail";
import Loader from "@/components/Loader";
import Page404 from "@/components/Page404";
import ScrollToTop from "@/components/novisual/ScrollToTop";

const LayoutWrapper = ({ children }) => {
  const location = useLocation();
  const { pathname } = location;

  // Rutas de autenticación que usan AuthLayout
  if (["/signin", "/signup", "/reset-password", "/confirm-email"].some(route => pathname.startsWith(route))) {
    return <AuthLayout>{children}</AuthLayout>;
  }

  return (
    <DefaultLayout>
      <EmailVerificationBanner />
      {children}
    </DefaultLayout>
  );
};

LayoutWrapper.propTypes = { 
    children: PropTypes.node.isRequired,
};

const App = () => {
  const PrivateRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
      return <Loader />;
    }
    return isAuthenticated ? children : <Navigate to="/signin" />;
  };

  PrivateRoute.propTypes = { 
    children: PropTypes.node.isRequired,
  };

  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <LayoutWrapper>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<SendResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
            <Route path="/photo/:photoId" element={<PhotoDetail />} />
            
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                   <Profile /> 
                </PrivateRoute>
              }
            />

            <Route
              path="/content-management"
              element={
                <PrivateRoute>
                  <ContentManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/orders-management"
              element={
                <PrivateRoute>
                  <OrdersManagement />
                </PrivateRoute>
              }
            />
            
            <Route path="*" element={<Page404 />} />
          </Routes>
        </LayoutWrapper>
      </AuthProvider>
    </Router>
  );
};

export default App;
