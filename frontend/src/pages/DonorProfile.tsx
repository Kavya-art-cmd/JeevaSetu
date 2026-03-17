import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type RegisteredDonor = {
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

  hospital_name?: string;
  emergency_city?: string;
  emergency_blood_group?: string;
  eta_text?: string;
  response_note?: string;
  distance_km?: number;
  travel_time_minutes?: number;
  map_link?: string;
};

type EligibilityData = {
  donor_id?: number;
  status?: string;
  readiness_score?: number;
  is_eligible?: boolean;
  cooldown_remaining_days?: number;
  next_eligible_date?: string;
  health_insights?: string;
};

function DonorProfile() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    email: user?.email || "",
    blood_group: "",
    age: "",
    weight_kg: "",
    gender: "",
    city: "",
    state: "",
    last_donation_date: "",
    has_chronic_disease: false,
    is_active: true,
  });

  const [registeredDonor, setRegisteredDonor] = useState<RegisteredDonor | null>(null);
  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [eligibilityError, setEligibilityError] = useState("");
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [responseLoading, setResponseLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchMyProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await api.get("/donors/me");
      const donor = response.data;

      setRegisteredDonor(donor);

      setFormData({
        full_name: donor.full_name || "",
        phone_number: donor.phone_number || "",
        email: donor.email || user?.email || "",
        blood_group: donor.blood_group || "",
        age: donor.age?.toString() || "",
        weight_kg: donor.weight_kg?.toString() || "",
        gender: donor.gender || "",
        city: donor.city || "",
        state: donor.state || "",
        last_donation_date: donor.last_donation_date || "",
        has_chronic_disease: donor.has_chronic_disease || false,
        is_active: donor.is_active ?? true,
      });
    } catch (error) {
      console.log("Donor profile not found yet");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProfile();
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async () => {
    try {
      setSuccessMessage("");
      setErrorMessage("");
      setEligibilityData(null);
      setEligibilityError("");

      const response = await api.post("/donors", {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        email: formData.email,
        blood_group: formData.blood_group,
        age: Number(formData.age),
        weight_kg: Number(formData.weight_kg),
        gender: formData.gender,
        city: formData.city,
        state: formData.state,
        last_donation_date: formData.last_donation_date,
        has_chronic_disease: formData.has_chronic_disease,
        is_active: formData.is_active,
      });

      setRegisteredDonor(response.data);
      setSuccessMessage("Donor profile registered successfully.");
    } catch (error) {
      console.error("Error registering donor:", error);
      setErrorMessage("Failed to register donor profile.");
    }
  };

  const handleCheckEligibility = async () => {
    if (!registeredDonor?.id) {
      setEligibilityError("Register donor profile first to check eligibility.");
      return;
    }

    try {
      setLoadingEligibility(true);
      setEligibilityError("");

      const response = await api.get(`/donors/${registeredDonor.id}/health_twin`);
      setEligibilityData(response.data);
    } catch (error) {
      console.error("Error fetching donor eligibility:", error);
      setEligibilityError("Failed to fetch donor eligibility data.");
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleEmergencyResponse = async (
    responseType: "accepted" | "declined"
  ) => {
    if (!registeredDonor?.id) {
      setErrorMessage("Donor profile not found.");
      return;
    }

    try {
      setResponseLoading(true);
      setSuccessMessage("");
      setErrorMessage("");

      const response = await api.post("/emergency/response", {
        donor_id: registeredDonor.id,
        response: responseType,
        note:
          responseType === "accepted"
            ? "I will be available in 10 minutes"
            : "Unable to reach hospital at this time",
      });

      setSuccessMessage(
        response.data.message || "Emergency response submitted successfully."
      );

      await fetchMyProfile();
    } catch (error) {
      console.error("Emergency response error:", error);
      setErrorMessage("Failed to submit emergency response.");
    } finally {
      setResponseLoading(false);
    }
  };

  const getConditionIndicator = (score?: number) => {
    if (score === undefined || score === null) {
      return {
        label: "Condition Not Available",
        badgeClass: "bg-gray-100 text-gray-700 border border-gray-200",
      };
    }

    if (score >= 90) {
      return {
        label: "Excellent Donor Condition",
        badgeClass: "bg-green-100 text-green-700 border border-green-200",
      };
    }

    if (score >= 80) {
      return {
        label: "Good Donor Condition",
        badgeClass: "bg-green-100 text-green-700 border border-green-200",
      };
    }

    if (score >= 70) {
      return {
        label: "Moderate Donor Condition",
        badgeClass: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    }

    return {
      label: "Not Recommended",
      badgeClass: "bg-red-100 text-red-700 border border-red-200",
    };
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "DONOR_ACCEPTED":
        return {
          label: "Donor Accepted Request",
          className: "bg-green-100 text-green-700 border border-green-200",
        };
      case "DONOR_DECLINED":
        return {
          label: "Donor Declined Request",
          className: "bg-red-100 text-red-700 border border-red-200",
        };
      case "EMERGENCY_RESERVED":
        return {
          label: "Emergency Reserved",
          className: "bg-red-100 text-red-700 border border-red-200",
        };
      case "AVAILABLE":
        return {
          label: "Available",
          className: "bg-green-100 text-green-700 border border-green-200",
        };
      case "COOLDOWN":
        return {
          label: "Cooldown Active",
          className: "bg-orange-100 text-orange-700 border border-orange-200",
        };
      default:
        return {
          label: status || "Unknown",
          className: "bg-gray-100 text-gray-700 border border-gray-200",
        };
    }
  };

  const condition = getConditionIndicator(eligibilityData?.readiness_score);
  const statusBadge = getStatusBadge(registeredDonor?.status);

  const readinessPercent = useMemo(() => {
    const score = eligibilityData?.readiness_score ?? 0;
    return Math.max(0, Math.min(100, score));
  }, [eligibilityData]);

  const infoRows = registeredDonor
    ? [
        { label: "Name", value: registeredDonor.full_name },
        { label: "Email", value: registeredDonor.email },
        { label: "Phone", value: registeredDonor.phone_number },
        { label: "Gender", value: registeredDonor.gender },
        { label: "Age", value: registeredDonor.age },
        { label: "Weight", value: `${registeredDonor.weight_kg} kg` },
        { label: "City", value: registeredDonor.city },
        { label: "State", value: registeredDonor.state },
        { label: "Last Donation", value: registeredDonor.last_donation_date || "N/A" },
        {
          label: "Chronic Disease",
          value: registeredDonor.has_chronic_disease ? "Yes" : "No",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-5 sm:p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold">Donor Portal</h2>
            <p className="text-red-100 mt-2 max-w-3xl text-sm md:text-base leading-relaxed">
              Manage your donor identity, emergency responses, digital health twin,
              eligibility, and donation readiness from a single dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[280px]">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Mode</p>
              <p className="font-semibold text-sm sm:text-base">Donor Dashboard</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Role</p>
              <p className="font-semibold text-sm sm:text-base">Self Profile</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">AI Module</p>
              <p className="font-semibold text-sm sm:text-base">Health Twin</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
              <p className="text-xs text-red-100">Alerts</p>
              <p className="font-semibold text-sm sm:text-base">Emergency Ready</p>
            </div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 shadow-sm">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 shadow-sm">
          {errorMessage}
        </div>
      )}

      <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6 hover:shadow-md transition">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Donor Registration</h3>
            <p className="text-sm text-gray-500 mt-1">
              Register or review your donor profile details.
            </p>
          </div>

          <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">
            Profile Setup
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Full Name"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="text"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            placeholder="Phone Number"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <select
            name="blood_group"
            value={formData.blood_group}
            onChange={handleChange}
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          >
            <option value="">Select Blood Group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>

          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            placeholder="Age"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="number"
            step="0.1"
            name="weight_kg"
            value={formData.weight_kg}
            onChange={handleChange}
            placeholder="Weight (kg)"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="text"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            placeholder="Gender"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="City"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="State"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <input
            type="date"
            name="last_donation_date"
            value={formData.last_donation_date}
            onChange={handleChange}
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />

          <label className="flex items-center gap-3 text-gray-700 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
            <input
              type="checkbox"
              name="has_chronic_disease"
              checked={formData.has_chronic_disease}
              onChange={handleChange}
            />
            Has Chronic Disease
          </label>

          <label className="flex items-center gap-3 text-gray-700 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Is Active
          </label>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-6 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.02]"
        >
          Register Donor Profile
        </button>
      </div>

      {profileLoading && (
        <div className="bg-white border rounded-3xl shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-52"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="h-24 bg-gray-100 rounded-2xl"></div>
              <div className="h-24 bg-gray-100 rounded-2xl"></div>
              <div className="h-24 bg-gray-100 rounded-2xl"></div>
              <div className="h-24 bg-gray-100 rounded-2xl"></div>
            </div>
          </div>
        </div>
      )}

      {registeredDonor && (
        <div className="bg-white border rounded-3xl shadow-sm p-5 md:p-6 hover:shadow-md transition">
          {registeredDonor.status === "EMERGENCY_RESERVED" && (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-800 px-5 py-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg md:text-xl">
                    Emergency Blood Request
                  </h3>
                  <p className="mt-2 text-sm md:text-base leading-relaxed">
                    You have been selected for an emergency blood donation. Please
                    respond immediately.
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <p className="break-words">
                      <b>Hospital:</b> {registeredDonor.hospital_name || "City Hospital"}
                    </p>
                    <p className="break-words">
                      <b>Blood Group:</b>{" "}
                      {registeredDonor.emergency_blood_group || registeredDonor.blood_group}
                    </p>
                    <p className="break-words">
                      <b>City:</b> {registeredDonor.emergency_city || registeredDonor.city}
                    </p>

                    {registeredDonor.distance_km !== undefined && (
                      <p className="break-words">
                        <b>Distance:</b> {registeredDonor.distance_km} km
                      </p>
                    )}

                    {registeredDonor.travel_time_minutes !== undefined && (
                      <p className="break-words">
                        <b>Estimated Travel Time:</b>{" "}
                        {registeredDonor.travel_time_minutes} minutes
                      </p>
                    )}

                    {registeredDonor.map_link && (
                      <p className="sm:col-span-2 break-words">
                        <b>Map:</b>{" "}
                        <a
                          href={registeredDonor.map_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline hover:text-blue-800"
                        >
                          Open Route Map
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 flex-col sm:flex-row w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => handleEmergencyResponse("accepted")}
                    disabled={responseLoading}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium transition-transform hover:scale-[1.02]"
                  >
                    {responseLoading ? "Submitting..." : "Accept Request"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEmergencyResponse("declined")}
                    disabled={responseLoading}
                    className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-transform hover:scale-[1.02]"
                  >
                    {responseLoading ? "Submitting..." : "Decline"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(registeredDonor.status === "DONOR_ACCEPTED" ||
            registeredDonor.status === "DONOR_DECLINED") && (
            <div className="mb-6 rounded-2xl border p-5 bg-white shadow-sm">
              <div
                className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusBadge.className}`}
              >
                {statusBadge.label}
              </div>

              {registeredDonor.status === "DONOR_ACCEPTED" && (
                <div className="mt-4 space-y-2 text-gray-700">
                  <p className="font-medium text-green-700 break-words">
                    ETA: {registeredDonor.eta_text || "10 minutes"}
                  </p>

                  <p className="break-words">
                    <b>Response Note:</b>{" "}
                    {registeredDonor.response_note || "I will be available in 10 minutes"}
                  </p>

                  {registeredDonor.distance_km !== undefined && (
                    <p className="break-words">
                      <b>Distance to Hospital:</b> {registeredDonor.distance_km} km
                    </p>
                  )}

                  {registeredDonor.travel_time_minutes !== undefined && (
                    <p className="break-words">
                      <b>Estimated Travel Time:</b>{" "}
                      {registeredDonor.travel_time_minutes} minutes
                    </p>
                  )}

                  {registeredDonor.map_link && (
                    <p className="break-words">
                      <b>Navigation:</b>{" "}
                      <a
                        href={registeredDonor.map_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        Open Route Map
                      </a>
                    </p>
                  )}
                </div>
              )}

              {registeredDonor.status === "DONOR_DECLINED" && (
                <div className="mt-4 text-gray-700">
                  <p className="leading-relaxed">
                    You declined the emergency request. The system can now assign
                    the next best donor.
                  </p>
                  <p className="mt-2 break-words">
                    <b>Response Note:</b>{" "}
                    {registeredDonor.response_note || "Unable to reach hospital at this time"}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">
                Donor Status Dashboard
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Your profile summary and current donation availability.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheckEligibility}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.02]"
            >
              {loadingEligibility ? "Checking..." : "Check Eligibility"}
            </button>
          </div>

          {eligibilityError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {eligibilityError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border bg-gray-50 p-5 transition-transform duration-200 hover:-translate-y-1">
              <p className="text-sm text-gray-500">Donor ID</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {registeredDonor.id}
              </p>
            </div>

            <div className="rounded-2xl border bg-red-50 p-5 transition-transform duration-200 hover:-translate-y-1">
              <p className="text-sm text-gray-500">Blood Group</p>
              <p className="text-lg font-bold text-red-700 mt-1">
                {registeredDonor.blood_group}
              </p>
            </div>

            <div className="rounded-2xl border bg-blue-50 p-5 transition-transform duration-200 hover:-translate-y-1">
              <p className="text-sm text-gray-500">Current Status</p>
              <p className="text-lg font-bold text-blue-700 mt-1 break-words">
                {registeredDonor.status}
              </p>
            </div>

            <div className="rounded-2xl border bg-green-50 p-5 transition-transform duration-200 hover:-translate-y-1">
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-lg font-bold text-green-700 mt-1">
                {registeredDonor.is_active ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 mb-6">
            {infoRows.map((row) => (
              <div
                key={row.label}
                className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <p className="text-sm text-gray-500">{row.label}</p>
                <p className="font-semibold text-gray-800 mt-1 break-words">
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {eligibilityData && (
            <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    My Digital Health Twin
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    This section shows only your personal twin and donation readiness.
                  </p>
                </div>

                <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1 rounded-full font-medium">
                  Personal Twin Only
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border bg-purple-50 p-5">
                  <p className="text-sm text-gray-500">Readiness Score</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {eligibilityData.readiness_score ?? "N/A"}
                  </p>

                  <div className="mt-3 h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-700"
                      style={{ width: `${readinessPercent}%` }}
                    />
                  </div>

                  <div className="mt-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${condition.badgeClass}`}
                    >
                      {condition.label}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-green-50 p-5">
                  <p className="text-sm text-gray-500">Eligibility</p>
                  <p className="text-lg font-bold text-green-700 mt-1">
                    {eligibilityData.is_eligible ? "Eligible" : "Not Eligible"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-amber-50 p-5">
                  <p className="text-sm text-gray-500">Cooldown Remaining</p>
                  <p className="text-lg font-bold text-amber-700 mt-1">
                    {eligibilityData.cooldown_remaining_days ?? 0} days
                  </p>
                </div>

                <div className="rounded-2xl border bg-blue-50 p-5">
                  <p className="text-sm text-gray-500">Next Eligible Date</p>
                  <p className="text-lg font-bold text-blue-700 mt-1 break-words">
                    {eligibilityData.next_eligible_date || "N/A"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-5 md:col-span-2 xl:col-span-4">
                  <p className="text-sm text-gray-500">Health Insights</p>
                  <p className="text-base font-medium text-gray-800 mt-1 break-words">
                    {eligibilityData.health_insights || "No health insights available."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DonorProfile;