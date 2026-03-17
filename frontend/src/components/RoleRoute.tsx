import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: React.ReactNode;
  allowedRoles: string[];
};

function RoleRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === "DONOR") {
      return (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-red-700 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600">
            Donor accounts cannot access hospital management pages.
          </p>
        </div>
      );
    }

    return (
      <div className="p-8 text-red-600 font-semibold">
        Access Denied — You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
}

export default RoleRoute;