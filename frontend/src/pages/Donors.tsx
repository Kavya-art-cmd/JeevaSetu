import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type Donor = {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  blood_group: string;
  age: number;
  weight_kg: number;
  gender: string;
  city: string;
  state: string;
  last_donation_date: string;
  has_chronic_disease: boolean;
  is_active: boolean;
  status: string;
};

function Donors() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [bloodFilter, setBloodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        setLoading(true);
        const response = await api.get("/donors");
        setDonors(response.data);
      } catch (error) {
        console.error("Error fetching donors:", error);
        setDonors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDonors();
  }, []);

  const filteredDonors = useMemo(() => {
    return donors.filter((donor) => {
      const matchesSearch =
        !searchText ||
        donor.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        donor.email?.toLowerCase().includes(searchText.toLowerCase()) ||
        donor.city?.toLowerCase().includes(searchText.toLowerCase()) ||
        donor.state?.toLowerCase().includes(searchText.toLowerCase()) ||
        donor.phone_number?.includes(searchText);

      const matchesBlood =
        !bloodFilter || donor.blood_group === bloodFilter;

      const matchesStatus =
        !statusFilter || donor.status === statusFilter;

      return matchesSearch && matchesBlood && matchesStatus;
    });
  }, [donors, searchText, bloodFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = donors.length;
    const active = donors.filter((d) => d.is_active).length;
    const chronic = donors.filter((d) => d.has_chronic_disease).length;
    const available = donors.filter((d) => d.status === "AVAILABLE").length;

    return { total, active, chronic, available };
  }, [donors]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-700 border border-green-200";
      case "COOLDOWN":
        return "bg-orange-100 text-orange-700 border border-orange-200";
      case "EMERGENCY_RESERVED":
        return "bg-red-100 text-red-700 border border-red-200";
      case "DONOR_ACCEPTED":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "DONOR_DECLINED":
        return "bg-gray-100 text-gray-700 border border-gray-200";
      default:
        return "bg-purple-100 text-purple-700 border border-purple-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-5 sm:p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Donor Management</h2>
            <p className="text-red-100 mt-2 max-w-3xl text-sm md:text-base leading-relaxed">
              Monitor all registered donors, review donor availability, track health
              conditions, and manage emergency-ready donor records from a centralized view.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[300px]">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Directory</p>
              <p className="font-semibold text-sm sm:text-base">All Donors</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Scope</p>
              <p className="font-semibold text-sm sm:text-base">Hospital View</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Tracking</p>
              <p className="font-semibold text-sm sm:text-base">Status Based</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Use Case</p>
              <p className="font-semibold text-sm sm:text-base">Emergency Ops</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Donors</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>

        <div className="rounded-2xl border bg-green-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Donors</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.active}</p>
        </div>

        <div className="rounded-2xl border bg-blue-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Available Now</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.available}</p>
        </div>

        <div className="rounded-2xl border bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Chronic Disease</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.chronic}</p>
        </div>
      </div>

      <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] xl:grid-cols-[1fr_auto_auto_auto] gap-4">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by donor name, email, city, state, or phone"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <select
            value={bloodFilter}
            onChange={(e) => setBloodFilter(e.target.value)}
            className="w-full xl:w-auto border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full xl:w-auto border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          >
            <option value="">All Status</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="COOLDOWN">COOLDOWN</option>
            <option value="EMERGENCY_RESERVED">EMERGENCY_RESERVED</option>
            <option value="DONOR_ACCEPTED">DONOR_ACCEPTED</option>
            <option value="DONOR_DECLINED">DONOR_DECLINED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchText("");
              setBloodFilter("");
              setStatusFilter("");
            }}
            className="w-full xl:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-4 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDonors.map((donor) => (
            <div
              key={donor.id}
              className="bg-white border border-gray-200 rounded-2xl shadow-md p-5 md:p-6 hover:shadow-lg transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-gray-800 break-words">
                    {donor.full_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 break-words">
                    {donor.city}, {donor.state}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold w-fit">
                    {donor.blood_group}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusBadge(
                      donor.status
                    )}`}
                  >
                    {donor.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">ID</p>
                  <p className="font-semibold text-gray-800 mt-1">{donor.id}</p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Phone</p>
                  <p className="font-semibold text-gray-800 mt-1 break-all">
                    {donor.phone_number}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:col-span-2">
                  <p className="text-gray-500">Email</p>
                  <p className="font-semibold text-gray-800 mt-1 break-all">
                    {donor.email}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Age</p>
                  <p className="font-semibold text-gray-800 mt-1">{donor.age}</p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Weight</p>
                  <p className="font-semibold text-gray-800 mt-1">
                    {donor.weight_kg} kg
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Gender</p>
                  <p className="font-semibold text-gray-800 mt-1 break-words">
                    {donor.gender}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Last Donation</p>
                  <p className="font-semibold text-gray-800 mt-1 break-words">
                    {donor.last_donation_date || "N/A"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Chronic Disease</p>
                  <p className="font-semibold text-gray-800 mt-1">
                    {donor.has_chronic_disease ? "Yes" : "No"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-gray-500">Active</p>
                  <p className="font-semibold text-gray-800 mt-1">
                    {donor.is_active ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Donors;