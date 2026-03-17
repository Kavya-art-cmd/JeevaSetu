import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type HeatmapItem = {
  city: string;
  state: string;
  blood_group: string;
  demand: number;
  lat: number;
  lng: number;
};

type HeatmapResponse = {
  total_requests: number;
  blood_group_filter: string;
  heatmap: HeatmapItem[];
};

function BloodDemandHeatmap() {
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHeatmapData = async (group: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/analytics/blood-demand-heatmap?blood_group=${encodeURIComponent(group)}`
      );

      setData(response.data);
    } catch (err) {
      console.error("Error fetching heatmap data:", err);
      setError("Failed to load blood demand heatmap data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData(bloodGroup);
  }, []);

  const handleFilter = () => {
    fetchHeatmapData(bloodGroup);
  };

  const getCircleRadius = (demand: number) => {
    if (demand >= 10) return 30;
    if (demand >= 5) return 22;
    if (demand >= 2) return 16;
    return 10;
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 10) return "Very High Demand";
    if (demand >= 5) return "High Demand";
    if (demand >= 2) return "Moderate Demand";
    return "Low Demand";
  };

  const demandStats = useMemo(() => {
    const items = data?.heatmap || [];
    const highDemandCities = items.filter((item) => item.demand >= 5).length;
    const maxDemand = items.length > 0 ? Math.max(...items.map((item) => item.demand)) : 0;
    const trackedCities = items.length;

    return {
      highDemandCities,
      maxDemand,
      trackedCities,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-5 sm:p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold">
              Blood Demand Heatmap
            </h2>
            <p className="text-red-100 mt-2 max-w-3xl text-sm md:text-base leading-relaxed">
              Visualize city-level emergency blood demand, identify regional hotspots,
              and support proactive inventory planning using geographic demand analysis.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[300px]">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Module</p>
              <p className="font-semibold text-sm sm:text-base">Demand Mapping</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">View</p>
              <p className="font-semibold text-sm sm:text-base">Geographic Insights</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Tracking</p>
              <p className="font-semibold text-sm sm:text-base">City Demand</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Use Case</p>
              <p className="font-semibold text-sm sm:text-base">Hospital Planning</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blood Group
            </label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full md:w-64 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
            >
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleFilter}
            className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition"
          >
            Load Heatmap Data
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl">
          Loading heatmap data...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border bg-red-50 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Blood Group Filter</p>
              <p className="text-xl font-bold text-red-700 mt-1">
                {data.blood_group_filter}
              </p>
            </div>

            <div className="rounded-2xl border bg-blue-50 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {data.total_requests}
              </p>
            </div>

            <div className="rounded-2xl border bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-gray-500">High Demand Cities</p>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {demandStats.highDemandCities}
              </p>
            </div>

            <div className="rounded-2xl border bg-purple-50 p-5 shadow-sm">
              <p className="text-sm text-gray-500">Tracked Cities</p>
              <p className="text-xl font-bold text-purple-700 mt-1">
                {demandStats.trackedCities}
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Geographic Blood Demand Map
                </h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Regional visualization of blood demand intensity for the selected group.
                </p>
              </div>

              <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium w-fit">
                Live Spatial Heat View
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border">
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                scrollWheelZoom={true}
                style={{ height: "min(60vh, 500px)", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {data.heatmap.map((item, index) => (
                  <CircleMarker
                    key={index}
                    center={[item.lat, item.lng]}
                    radius={getCircleRadius(item.demand)}
                    pathOptions={{
                      color: "red",
                      fillColor: "red",
                      fillOpacity: 0.45,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p>
                          <b>City:</b> {item.city}
                        </p>
                        <p>
                          <b>State:</b> {item.state}
                        </p>
                        <p>
                          <b>Blood Group:</b> {item.blood_group}
                        </p>
                        <p>
                          <b>Demand:</b> {item.demand}
                        </p>
                        <p>
                          <b>Level:</b> {getDemandLabel(item.demand)}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-red-500 inline-block"></span>
                Low Demand
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500 inline-block opacity-70"></span>
                Moderate Demand
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-500 inline-block opacity-70"></span>
                High Demand
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-red-500 inline-block opacity-70"></span>
                Very High Demand
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  City-wise Blood Demand
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Structured demand records for planning and review.
                </p>
              </div>

              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium w-fit">
                Demand Table
              </span>
            </div>

            {data.heatmap.length === 0 ? (
              <div className="text-gray-500">
                No demand data found for this blood group.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        City
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        State
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Blood Group
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Demand
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Latitude
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Longitude
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.heatmap.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-3 text-gray-800 break-words">
                          {item.city}
                        </td>
                        <td className="px-4 py-3 text-gray-800 break-words">
                          {item.state}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {item.blood_group}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-700">
                          {item.demand}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {item.lat}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {item.lng}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default BloodDemandHeatmap;