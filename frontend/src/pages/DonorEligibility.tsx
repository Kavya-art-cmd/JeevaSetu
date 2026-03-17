import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type Donor = {
  id: number;
  full_name: string;
  blood_group: string;
  city: string;
  state: string;
};

type DonorWithTwin = Donor & {
  twin: any;
};

function DonorEligibility() {
  const [donors, setDonors] = useState<DonorWithTwin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [bloodFilter, setBloodFilter] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");

  const fetchDonors = async () => {
    try {
      setLoading(true);

      const res = await api.get("/donors");
      const donorList = res.data;

      const twins = await Promise.all(
        donorList.map(async (d: Donor) => {
          try {
            const twin = await api.get(`/donors/${d.id}/health_twin`);
            return { ...d, twin: twin.data };
          } catch {
            return { ...d, twin: null };
          }
        })
      );

      setDonors(twins);
    } catch (error) {
      console.error("Error fetching donors:", error);
      setDonors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const getConditionIndicator = (score?: number) => {
    if (score === undefined || score === null) {
      return {
        label: "Condition Unknown",
        badgeClass: "bg-gray-100 text-gray-700 border border-gray-200",
      };
    }

    if (score >= 90) {
      return {
        label: "Excellent",
        badgeClass: "bg-green-100 text-green-700 border border-green-200",
      };
    }

    if (score >= 80) {
      return {
        label: "Good",
        badgeClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      };
    }

    if (score >= 70) {
      return {
        label: "Moderate",
        badgeClass: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    }

    return {
      label: "Low / Risk",
      badgeClass: "bg-red-100 text-red-700 border border-red-200",
    };
  };

  const filteredDonors = useMemo(() => {
    return donors.filter((d) => {
      const matchesSearch =
        !searchText ||
        d.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        d.city?.toLowerCase().includes(searchText.toLowerCase()) ||
        d.state?.toLowerCase().includes(searchText.toLowerCase()) ||
        d.blood_group?.toLowerCase().includes(searchText.toLowerCase());

      const matchesBlood = !bloodFilter || d.blood_group === bloodFilter;

      const isEligible = d.twin?.is_eligible ? "eligible" : "not-eligible";
      const matchesEligibility =
        !eligibilityFilter || eligibilityFilter === isEligible;

      return matchesSearch && matchesBlood && matchesEligibility;
    });
  }, [donors, searchText, bloodFilter, eligibilityFilter]);

  const stats = useMemo(() => {
    const total = donors.length;
    const eligible = donors.filter((d) => d.twin?.is_eligible).length;
    const notEligible = donors.filter((d) => d.twin && !d.twin?.is_eligible).length;
    const avgScore =
      donors.length > 0
        ? Math.round(
            donors.reduce((sum, d) => sum + (d.twin?.readiness_score || 0), 0) /
              donors.length
          )
        : 0;

    return { total, eligible, notEligible, avgScore };
  }, [donors]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-5 sm:p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold">
              Hospital Donor Eligibility Engine
            </h2>
            <p className="text-red-100 mt-2 max-w-3xl text-sm md:text-base leading-relaxed">
              Monitor all donor digital twins, readiness scores, cooldown periods,
              and AI-based eligibility insights from a single hospital-side dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[300px]">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">AI Module</p>
              <p className="font-semibold text-sm sm:text-base">Twin Analysis</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">View</p>
              <p className="font-semibold text-sm sm:text-base">All Donors</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Mode</p>
              <p className="font-semibold text-sm sm:text-base">Hospital Control</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Tracking</p>
              <p className="font-semibold text-sm sm:text-base">Eligibility Live</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1">
          <p className="text-sm text-gray-500">Total Donors</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>

        <div className="rounded-2xl border bg-green-50 p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1">
          <p className="text-sm text-gray-500">Eligible</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.eligible}</p>
        </div>

        <div className="rounded-2xl border bg-red-50 p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1">
          <p className="text-sm text-gray-500">Not Eligible</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.notEligible}</p>
        </div>

        <div className="rounded-2xl border bg-purple-50 p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1">
          <p className="text-sm text-gray-500">Average Twin Score</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{stats.avgScore}</p>
        </div>
      </div>

      <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-4">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by donor name, city, state, or blood group"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <select
            value={bloodFilter}
            onChange={(e) => setBloodFilter(e.target.value)}
            className="w-full lg:w-auto border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          >
            <option value="">All Blood Groups</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>

          <select
            value={eligibilityFilter}
            onChange={(e) => setEligibilityFilter(e.target.value)}
            className="w-full lg:w-auto border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          >
            <option value="">All Eligibility</option>
            <option value="eligible">Eligible</option>
            <option value="not-eligible">Not Eligible</option>
          </select>

          <button
            type="button"
            onClick={fetchDonors}
            className="w-full lg:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.02]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="bg-white border rounded-2xl p-6 shadow-sm animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-40 mb-3"></div>
              <div className="h-4 bg-gray-100 rounded w-28 mb-5"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredDonors.length === 0 ? (
        <div className="bg-white border rounded-3xl shadow-sm p-10 text-center">
          <h3 className="text-xl font-semibold text-gray-800">No donors found</h3>
          <p className="text-gray-500 mt-2">
            Try changing the search text or filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDonors.map((d, index) => {
            const score = d.twin?.readiness_score ?? 0;
            const scorePercent = Math.max(0, Math.min(100, score));
            const condition = getConditionIndicator(score);

            return (
              <div
                key={d.id}
                className="bg-white border rounded-3xl p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 break-words">
                      {d.full_name}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1 break-words">
                      {d.blood_group} • {d.city}, {d.state}
                    </p>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold w-fit ${
                      d.twin?.is_eligible
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                    }`}
                  >
                    {d.twin?.is_eligible ? "Eligible" : "Not Eligible"}
                  </span>
                </div>

                {d.twin ? (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-gray-500">Readiness Score</p>
                        <p className="font-bold text-purple-700 text-lg">
                          {d.twin.readiness_score ?? "N/A"}
                        </p>
                      </div>

                      <div className="mt-3 h-2.5 w-full bg-purple-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-700"
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>

                      <div className="mt-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${condition.badgeClass}`}
                        >
                          {condition.label}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
                        <p className="text-gray-500">Eligibility</p>
                        <p className="font-bold text-green-700 mt-1">
                          {d.twin.is_eligible ? "Yes" : "No"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                        <p className="text-gray-500">Cooldown</p>
                        <p className="font-bold text-amber-700 mt-1">
                          {d.twin.cooldown_remaining_days ?? 0} days
                        </p>
                      </div>

                      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 sm:col-span-2">
                        <p className="text-gray-500">Next Eligible Date</p>
                        <p className="font-bold text-blue-700 mt-1 break-words">
                          {d.twin.next_eligible_date || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                      <p className="text-gray-500 mb-1">Health Insights</p>
                      <p className="text-gray-700 leading-relaxed break-words">
                        {d.twin.health_insights || "No health insights available."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-gray-600">
                    Twin data is not available for this donor.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DonorEligibility;