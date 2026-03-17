import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import RoleRoute from "./components/RoleRoute";

import PortalIntro from "./pages/PortalIntro";
import Dashboard from "./pages/Dashboard";
import Donors from "./pages/Donors";
import Emergency from "./pages/Emergency";
import AllocationHistory from "./pages/AllocationHistory";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DonorProfile from "./pages/DonorProfile";
import DonorEligibility from "./pages/DonorEligibility";
import BloodDemandHeatmap from "./pages/BloodDemandHeatmap";
import Footer from "./components/Footer";

function App() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const introSeen = sessionStorage.getItem("jeevasetu_intro_seen") === "true";

  const isPublicRoute =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/signup";

  const shouldShowIntro =
    !user && !introSeen && isPublicRoute && location.pathname !== "/";

  if (shouldShowIntro) {
    return <Navigate to="/" replace />;
  }

  const isIntroPage = location.pathname === "/" && !user;

  return (
    <div className={isIntroPage ? "" : "min-h-screen bg-gray-100"}>
      {!isIntroPage && (
        <header className="bg-[#7a0000] text-white shadow-lg border-b border-red-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white p-2 shadow-md shrink-0 flex items-center justify-center">
                  <img
                    src="/jeevasetu-logo.png"
                    alt="JeevaSetu"
                    className="h-12 w-auto object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                    JeevaSetu
                  </h1>
                  <p className="text-sm sm:text-base mt-1 leading-relaxed text-red-50">
                    Bridging Life • Saving Futures
                  </p>
                </div>
              </div>

              <div className="text-sm w-full xl:w-auto">
                {user ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 xl:justify-end">
                    <span className="break-all text-red-50 text-sm sm:text-base">
                      {user.email} ({user.role})
                    </span>

                    <button
                      onClick={logout}
                      className="bg-white text-red-700 px-5 py-2.5 rounded-xl font-semibold w-full sm:w-auto hover:bg-red-50 transition"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 xl:justify-end">
                    <Link
                      to="/login"
                      className="bg-white text-red-700 px-5 py-2.5 rounded-xl font-semibold text-center w-full sm:w-auto hover:bg-red-50 transition"
                    >
                      Login
                    </Link>

                    <Link
                      to="/signup"
                      className="bg-red-950 text-white px-5 py-2.5 rounded-xl font-semibold text-center w-full sm:w-auto hover:bg-black/30 transition"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {user && !isIntroPage && (
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-wrap gap-x-4 gap-y-3 sm:gap-x-6">
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/dashboard"
                  className="text-red-700 font-medium hover:underline"
                >
                  Dashboard
                </Link>
              )}
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/donors"
                  className="text-red-700 font-medium hover:underline"
                >
                  Donors
                </Link>
              )}
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/donor-eligibility"
                  className="text-red-700 font-medium hover:underline"
                >
                  Donor Eligibility
                </Link>
              )}
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/emergency"
                  className="text-red-700 font-medium hover:underline"
                >
                  Emergency
                </Link>
              )}
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/history"
                  className="text-red-700 font-medium hover:underline"
                >
                  Allocation History
                </Link>
              )}
              {(user.role === "HOSPITAL" || user.role === "ADMIN") && (
                <Link
                  to="/heatmap"
                  className="text-red-700 font-medium hover:underline"
                >
                  Blood Demand Heatmap
                </Link>
              )}
              {user.role === "DONOR" && (
                <Link
                  to="/donor-profile"
                  className="text-red-700 font-medium hover:underline"
                >
                  My Profile
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      {isIntroPage ? (
        <Routes>
          <Route path="/" element={<PortalIntro />} />
        </Routes>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route
                path="/dashboard"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <Dashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/donors"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <Donors />
                  </RoleRoute>
                }
              />
              <Route
                path="/donor-eligibility"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <DonorEligibility />
                  </RoleRoute>
                }
              />
              <Route
                path="/emergency"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <Emergency />
                  </RoleRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <AllocationHistory />
                  </RoleRoute>
                }
              />
              <Route
                path="/heatmap"
                element={
                  <RoleRoute allowedRoles={["HOSPITAL", "ADMIN"]}>
                    <BloodDemandHeatmap />
                  </RoleRoute>
                }
              />
              <Route
                path="/donor-profile"
                element={
                  <RoleRoute allowedRoles={["DONOR"]}>
                    <DonorProfile />
                  </RoleRoute>
                }
              />
            </Routes>
          </div>
        </main>
      )}
      <Footer />
    </div>
  );
}

export default App;
