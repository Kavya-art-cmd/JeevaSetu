import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type AllocationRecord = {
  id: number;
  donor_id?: number;
  donor_name?: string | null;
  donor_phone?: string | null;
  donor_email?: string | null;
  donor_city?: string | null;
  donor_state?: string | null;
  blood_group: string;
  patient_city: string;
  patient_state: string;
  readiness_score: number;
  priority_score: number;
  allocated_at: string;
  completed_at?: string | null;
  status: string;
};

function AllocationHistory() {
  const [history, setHistory] = useState<AllocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await api.get("/allocation-history/");
        setHistory(response.data);
      } catch (error) {
        console.error("Error fetching allocation history:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      const matchesSearch =
        !searchText ||
        String(record.id).includes(searchText) ||
        String(record.donor_id ?? "").includes(searchText) ||
        record.donor_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        record.patient_city?.toLowerCase().includes(searchText.toLowerCase()) ||
        record.patient_state?.toLowerCase().includes(searchText.toLowerCase()) ||
        record.blood_group?.toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus =
        !statusFilter || record.status?.toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [history, searchText, statusFilter]);

  const stats = useMemo(() => {
    const total = history.length;
    const completed = history.filter((item) => item.status === "COMPLETED").length;
    const allocated = history.filter((item) => item.status === "ALLOCATED").length;
    const cancelled = history.filter((item) => item.status === "CANCELLED").length;

    return { total, completed, allocated, cancelled };
  }, [history]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700 border border-green-200";
      case "ALLOCATED":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-5 sm:p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">
              Allocation History
            </h2>
            <p className="text-red-100 mt-2 max-w-3xl text-sm md:text-base leading-relaxed">
              Review emergency donor allocations, completion records, readiness
              scores, and patient-city demand activity across the system.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[280px]">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Records</p>
              <p className="font-semibold text-sm sm:text-base">
                {stats.total}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Completed</p>
              <p className="font-semibold text-sm sm:text-base">
                {stats.completed}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Allocated</p>
              <p className="font-semibold text-sm sm:text-base">
                {stats.allocated}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Cancelled</p>
              <p className="font-semibold text-sm sm:text-base">
                {stats.cancelled}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Records</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>

        <div className="rounded-2xl border bg-green-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {stats.completed}
          </p>
        </div>

        <div className="rounded-2xl border bg-blue-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Allocated</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {stats.allocated}
          </p>
        </div>

        <div className="rounded-2xl border bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Cancelled</p>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {stats.cancelled}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by record ID, donor ID, donor name, patient city, state, or blood group"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full lg:w-auto border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchText("");
              setStatusFilter("");
            }}
            className="w-full lg:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 animate-pulse"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-100 rounded"></div>
                <div className="h-5 bg-gray-100 rounded"></div>
                <div className="h-5 bg-gray-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white border rounded-3xl shadow-sm p-10 text-center">
          <h3 className="text-xl font-semibold text-gray-800">
            No allocation history found
          </h3>
          <p className="text-gray-500 mt-2">
            Try changing the search text or filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((record) => (
            <div
              key={record.id}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 hover:shadow-md transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 break-words">
                    Allocation Record #{record.id}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 break-words">
                    {record.blood_group} request • {record.patient_city},{" "}
                    {record.patient_state}
                  </p>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-full font-semibold w-fit ${getStatusBadge(
                    record.status
                  )}`}
                >
                  {record.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Donor ID</p>
                  <p className="font-bold text-gray-800 mt-1">
                    {record.donor_id ?? "N/A"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-purple-50 p-4">
                  <p className="text-sm text-gray-500">Readiness Score</p>
                  <p className="font-bold text-purple-700 mt-1">
                    {record.readiness_score}
                  </p>
                </div>

                <div className="rounded-2xl border bg-blue-50 p-4">
                  <p className="text-sm text-gray-500">Priority Score</p>
                  <p className="font-bold text-blue-700 mt-1">
                    {record.priority_score}
                  </p>
                </div>

                <div className="rounded-2xl border bg-red-50 p-4">
                  <p className="text-sm text-gray-500">Blood Group</p>
                  <p className="font-bold text-red-700 mt-1">
                    {record.blood_group}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Donor Details
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="break-words">
                      <span className="font-semibold">Name:</span>{" "}
                      {record.donor_name || "N/A"}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold">Phone:</span>{" "}
                      {record.donor_phone || "N/A"}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold">Email:</span>{" "}
                      {record.donor_email || "N/A"}
                    </p>
                    <p className="break-words">
                      <span className="font-semibold">Location:</span>{" "}
                      {record.donor_city || "N/A"},{" "}
                      {record.donor_state || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Allocation Details
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="break-words">
                      <span className="font-semibold">Patient City:</span>{" "}
                      {record.patient_city}
                    </p>
                    <p className="break-words">
                      <span className="font-semibold">Patient State:</span>{" "}
                      {record.patient_state}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold">Allocated At:</span>{" "}
                      {record.allocated_at}
                    </p>
                    <p className="break-all">
                      <span className="font-semibold">Completed At:</span>{" "}
                      {record.completed_at || "Not completed yet"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllocationHistory;