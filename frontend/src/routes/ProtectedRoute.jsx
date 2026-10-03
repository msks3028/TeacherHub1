import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/common/StateViews";

/**
 * Client-side gate for UX only (avoids flashing the wrong dashboard).
 * The REAL authorization check happens on every API call in the backend
 * (see middleware/auth.js authorize()) — this component is not the
 * security boundary, just a convenience redirect.
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-6 max-w-page mx-auto">
        <LoadingState label="جارِ التحميل..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "TEACHER" ? "/teacher" : "/student"} replace />;
  }

  return <Outlet />;
}
