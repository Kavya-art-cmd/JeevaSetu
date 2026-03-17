import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function PortalIntro() {
  const navigate = useNavigate();

  const goToLogin = () => {
    sessionStorage.setItem("jeevasetu_intro_seen", "true");
    navigate("/login");
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem("jeevasetu_intro_seen", "true");
      navigate("/login");
    }, 4500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#1a0000] to-[#320000] text-white flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-120px] h-72 w-72 rounded-full bg-red-600/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-120px] right-[-120px] h-80 w-80 rounded-full bg-orange-500/20 blur-3xl animate-pulse" />
      </div>

      <button
        onClick={goToLogin}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur text-sm font-medium hover:bg-white/20 transition"
      >
        Skip Intro
      </button>

      <div className="relative z-10 w-full max-w-4xl text-center">
        <div className="mx-auto w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 rounded-3xl bg-white p-4 sm:p-5 shadow-2xl animate-fadeInScale">
          <img
            src="/jeevasetu-logo.png"
            alt="JeevaSetu Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight animate-fadeInUp">
          JeevaSetu
        </h1>

        <p className="mt-4 text-lg sm:text-xl md:text-2xl text-red-100 font-medium animate-fadeInUp">
          Bridging Life • Saving Futures
        </p>

        <p className="mt-4 text-sm sm:text-base md:text-lg text-gray-200 max-w-3xl mx-auto leading-relaxed animate-fadeInUp">
          A predictive and preventive voice enabled emergency blood management system
        </p>

        <div className="mt-8 animate-fadeInUp">
          <button
            onClick={goToLogin}
            className="px-8 sm:px-10 py-3 sm:py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Enter Portal
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(24px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 1.1s ease-out;
        }

        .animate-fadeInScale {
          animation: fadeInScale 1.1s ease-out;
        }
      `}</style>
    </div>
  );
}

export default PortalIntro;