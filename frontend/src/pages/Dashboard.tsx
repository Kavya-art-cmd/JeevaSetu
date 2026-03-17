import { useEffect, useState } from "react";
import api from "../services/api";
import DonorMap from "../components/DonorMap";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

type DashboardData = {
  accessed_by?: string;
  total_donors?: number;
  active?: number;
  cooldown?: number;
  inactive?: number;
  emergency_reserved?: number;
  upcoming_eligible_next_7_days?: number;
  blood_group_distribution?: Record<string, number>;
  city_distribution?: Record<string, number>;
};

type ForecastPoint = {
  ds: string;
  yhat: number;
  alert: string;
};

type ForecastData = {
  accessed_by?: string;
  blood_group?: string;
  city?: string;
  days?: number;
  threshold?: number;
  model_file_used?: string;
  labels?: string[];
  values?: number[];
  alerts?: string[];
  points?: ForecastPoint[];
};

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CITY_OPTIONS = ["Hyderabad", "Mumbai"];

function Dashboard() {
  const [data, setData] = useState<DashboardData>({});
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");

  const [forecastForm, setForecastForm] = useState({
    blood_group: "O+",
    city: "Hyderabad",
    days: "15",
    threshold: "14",
  });

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching dashboard data:", error);
      });

    fetchForecast({
      blood_group: "O+",
      city: "Hyderabad",
      days: "15",
      threshold: "14",
    });
  }, []);

  const fetchForecast = async (params: {
    blood_group: string;
    city: string;
    days: string;
    threshold: string;
  }) => {
    try {
      setForecastLoading(true);
      setForecastError("");
      setForecast(null);

      const response = await api.get("/dashboard/forecast-series", {
        params: {
          blood_group: params.blood_group,
          city: params.city.trim(),
          days: Number(params.days),
          threshold: Number(params.threshold),
        },
      });

      setForecast(response.data);
    } catch (error: any) {
      console.error("Error fetching forecast data:", error);
      setForecastError(
        error?.response?.data?.detail ||
          "Forecast could not be loaded for the given inputs."
      );
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  };

  const handleForecastChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForecastForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleForecastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchForecast(forecastForm);
  };

  const bloodData = data.blood_group_distribution
    ? Object.entries(data.blood_group_distribution).map(([key, value]) => ({
        name: key,
        value: value,
      }))
    : [];

  const cityData = data.city_distribution
    ? Object.entries(data.city_distribution).map(([key, value]) => ({
        name: key,
        value: value,
      }))
    : [];

  const forecastChartData =
    forecast?.points?.map((point) => ({
      date: point.ds,
      demand: point.yhat,
      alert: point.alert,
    })) || [];

  const highAlertCount =
    forecast?.points?.filter((point) => point.alert?.toLowerCase() !== "normal")
      .length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-2">
          Hospital Dashboard
        </h2>

        <p className="text-gray-600 break-all">
          Accessed by: <span className="font-semibold">{data.accessed_by}</span>
        </p>
      </div>

      <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-2xl shadow-sm">
        <h3 className="text-base sm:text-lg font-semibold">
          Active Emergency Monitoring
        </h3>
        <p className="text-sm mt-1 leading-relaxed">
          JeevaSetu continuously tracks donor availability, emergency requests,
          allocation readiness, and blood demand forecasting in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Total Donors</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-red-700 mt-2">
            {data.total_donors ?? 0}
          </h3>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Active</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-green-700 mt-2">
            {data.active ?? 0}
          </h3>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Cooldown</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-orange-600 mt-2">
            {data.cooldown ?? 0}
          </h3>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Inactive</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-700 mt-2">
            {data.inactive ?? 0}
          </h3>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Emergency Reserved</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-blue-700 mt-2">
            {data.emergency_reserved ?? 0}
          </h3>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-gray-500">Upcoming Eligible</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-purple-700 mt-2">
            {data.upcoming_eligible_next_7_days ?? 0}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Blood Group Distribution</h3>
            <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium w-fit">
              Donor Composition
            </span>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={bloodData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
              >
                {bloodData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">City Distribution</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium w-fit">
              Regional Coverage
            </span>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">
              Blood Demand Forecast
            </h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              AI-driven forecast of expected blood demand by city and blood group.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium">
              AI Forecasting
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              Threshold Alerts
            </span>
            <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
              Decision Support
            </span>
          </div>
        </div>

        <form
          onSubmit={handleForecastSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blood Group
            </label>
            <select
              name="blood_group"
              value={forecastForm.blood_group}
              onChange={handleForecastChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            >
              {BLOOD_GROUP_OPTIONS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <select
              name="city"
              value={forecastForm.city}
              onChange={handleForecastChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            >
              {CITY_OPTIONS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days
            </label>
            <input
              type="number"
              name="days"
              value={forecastForm.days}
              onChange={handleForecastChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
              placeholder="Enter number of days"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Threshold
            </label>
            <input
              type="number"
              name="threshold"
              value={forecastForm.threshold}
              onChange={handleForecastChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
              placeholder="Enter alert threshold"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={forecastLoading}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-6 py-3 rounded-lg font-medium"
            >
              {forecastLoading ? "Loading..." : "Load Forecast"}
            </button>
          </div>
        </form>

        {forecastError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {forecastError}
          </div>
        )}

        {forecast && (
          <>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Forecast for{" "}
              <span className="font-semibold">{forecast.blood_group || "-"}</span>{" "}
              in <span className="font-semibold">{forecast.city || "-"}</span> for{" "}
              <span className="font-semibold">{forecast.days || 0}</span> days
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm text-gray-500">Blood Group</p>
                <h4 className="text-xl sm:text-2xl font-bold text-red-700 mt-2">
                  {forecast.blood_group || "N/A"}
                </h4>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-gray-500">City</p>
                <h4 className="text-xl sm:text-2xl font-bold text-blue-700 mt-2 break-all">
                  {forecast.city || "N/A"}
                </h4>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm text-gray-500">Model File</p>
                <h4 className="text-base sm:text-lg font-bold text-green-700 break-all mt-2">
                  {forecast.model_file_used || "N/A"}
                </h4>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm text-gray-500">Alert Days</p>
                <h4 className="text-xl sm:text-2xl font-bold text-amber-700 mt-2">
                  {highAlertCount}
                </h4>
              </div>
            </div>

            <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8 mt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-gray-800">
                    AI Predicted Blood Demand (Next {forecast.days || 0} Days)
                  </h4>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    Forecast trend generated from the selected city and blood group model.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium">
                    Predicted Demand Curve
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                    Threshold: {forecast.threshold}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={forecastChartData}
                  margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="demand"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Predicted Demand"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 bg-gray-50 border rounded-2xl p-4 sm:p-5">
              <h4 className="text-md font-semibold mb-3 text-gray-800">
                Forecast Interpretation
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                This chart helps hospitals anticipate blood demand fluctuations in
                advance. Higher predicted values indicate increased planning needs
                for donor mobilization, inventory checks, and emergency preparedness.
              </p>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4 text-gray-800">
                Forecast Alerts
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {forecast.points?.map((point, index) => (
                  <div key={index} className="border rounded-xl p-4 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-800 mb-2 break-all">
                      {point.ds}
                    </p>
                    <p className="text-sm text-gray-600 break-all">
                      Demand: {point.yhat}
                    </p>
                    <p
                      className={`text-sm mt-1 font-medium ${
                        point.alert?.toLowerCase() === "normal"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      Alert: {point.alert}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
              Donor Location Map
            </h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Real-time geographic view of donor availability for operational planning.
            </p>
          </div>

          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium w-fit">
            Live Spatial Monitoring
          </span>
        </div>

        <div className="rounded-2xl overflow-hidden">
          <DonorMap />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;