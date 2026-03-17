import { useEffect, useRef, useState } from "react";
import api from "../services/api";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

type EmergencyFormData = {
  blood_group: string;
  required_units: string;
  city: string;
  state: string;
};

type MatchDonor = {
  id?: number;
  donor_id?: number;
  full_name?: string;
  phone_number?: string;
  email?: string;
  city?: string;
  state?: string;
  blood_group?: string;
  readiness_score?: number;
  priority_score?: number;
  eta_minutes?: number;
  distance_level?: string;
};

type SmsResult = {
  donor_id?: number;
  phone_number?: string;
  sms_status_code?: number;
  sms_sid?: string;
  delivery_status?: string;
  detailed_status?: string;
  sms_error?: string;
  call_result?: any;
  call_error?: string;
};

type AllocationResponse = {
  status?: string;
  matched_units?: number;
  message?: string;
  matched_donors?: MatchDonor[];
  fastest_eta_minutes?: number;
  sms_results?: SmsResult[];
};

type VoiceResponseData = {
  voice_transcript?: string;
  parsed_request?: {
    blood_group?: string;
    required_units?: number;
    city?: string;
    state?: string;
  };
  result?: {
    status?: string;
    matched_units?: number;
    message?: string;
  };
  broadcast?: {
    status?: string;
    broadcast_scope?: string;
    next_step?: string;
    channels_used?: string[];
    broadcast_message?: string;
    timestamp?: string;
  };
};

function Emergency() {
  const [formData, setFormData] = useState<EmergencyFormData>({
    blood_group: "",
    required_units: "",
    city: "",
    state: "",
  });

  const [responseData, setResponseData] = useState<AllocationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [communicationStatus, setCommunicationStatus] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [pageError, setPageError] = useState("");

  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceResponse, setVoiceResponse] = useState<VoiceResponseData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [completeDonorId, setCompleteDonorId] = useState("");
  const [completeLoading, setCompleteLoading] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setVoiceSupported(true);

      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError("");
        setInterimTranscript("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let liveTranscript = "";

        for (let i = 0; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + " ";
          } else {
            liveTranscript += transcriptPiece;
          }
        }

        if (finalTranscript.trim()) {
          setVoiceTranscript((prev) => `${prev} ${finalTranscript}`.trim());
        }

        setInterimTranscript(liveTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setVoiceError("Voice recognition failed. Please try again.");
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setPageError("");
      setPageMessage("");
      setCommunicationStatus("");
      setResponseData(null);

      const response = await api.post("/emergency/match", {
        blood_group: formData.blood_group,
        required_units: Number(formData.required_units),
        city: formData.city,
        state: formData.state,
      });

      setResponseData(response.data);
      setPageMessage("Emergency request processed successfully.");

      if (response.data?.matched_donors?.length > 0) {
        setCommunicationStatus(
          "Eligible donors were matched. SMS alerts and automatic fallback calling workflow have been triggered."
        );
      } else {
        setCommunicationStatus(
          "No direct donor match found. You can trigger emergency broadcast from this page."
        );
      }
    } catch (error) {
      console.error("Error submitting emergency request:", error);
      setPageError("Emergency request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    try {
      setBroadcastLoading(true);
      setPageError("");
      setPageMessage("");

      const response = await api.post("/emergency/broadcast", {
        blood_group: formData.blood_group,
        required_units: Number(formData.required_units),
        city: formData.city,
        state: formData.state,
      });

      setPageMessage(
        response.data?.message || "Emergency donor broadcast triggered successfully."
      );
    } catch (error) {
      console.error("Broadcast error:", error);
      setPageError("Emergency broadcast failed.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleCompleteDonation = async (donorId?: number | string) => {
    if (!donorId) {
      setPageError("Donor ID not found for completion.");
      return;
    }

    try {
      setCompleteLoading(true);
      setPageError("");
      setPageMessage("");

      const response = await api.post(`/emergency/donor/${donorId}/complete`);

      setPageMessage(
        response.data?.status === "COMPLETED"
          ? `Donation completed successfully for donor ${donorId}.`
          : "Donation completion request submitted."
      );

      setCompleteDonorId("");
    } catch (error) {
      console.error("Complete donation error:", error);
      setPageError("Failed to complete donation.");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleStartListening = () => {
    if (!recognitionRef.current) {
      setVoiceError("Voice recognition is not supported in this browser.");
      return;
    }

    setVoiceError("");
    setInterimTranscript("");
    recognitionRef.current.start();
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleClearTranscript = () => {
    setVoiceTranscript("");
    setInterimTranscript("");
    setVoiceResponse(null);
    setVoiceError("");
  };

  const handleVoiceSubmit = async () => {
    if (!voiceTranscript.trim()) {
      setVoiceError("Please record a voice command first.");
      return;
    }

    const numberWords: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
    };

    let normalizedTranscript = voiceTranscript.toLowerCase();

    normalizedTranscript = normalizedTranscript
      .replace(/\bo positive\b/g, "O+")
      .replace(/\bo negative\b/g, "O-")
      .replace(/\ba positive\b/g, "A+")
      .replace(/\ba negative\b/g, "A-")
      .replace(/\bb positive\b/g, "B+")
      .replace(/\bb negative\b/g, "B-")
      .replace(/\bab positive\b/g, "AB+")
      .replace(/\bab negative\b/g, "AB-");

    Object.entries(numberWords).forEach(([word, num]) => {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      normalizedTranscript = normalizedTranscript.replace(regex, String(num));
    });

    normalizedTranscript = normalizedTranscript
      .replace(/\bto units\b/g, "2 units")
      .replace(/\btoo units\b/g, "2 units")
      .replace(/\bfor units\b/g, "4 units");

    try {
      const response = await api.post("/voice/emergency/activate", {
        transcript: normalizedTranscript,
      });

      setVoiceResponse(response.data);
      setPageMessage("Voice emergency activation completed successfully.");
    } catch (error) {
      console.error("Voice activation error:", error);
      setVoiceError("Voice emergency activation failed.");
    }
  };

  const VoiceVisualizer = () => {
    const bars = [40, 65, 90, 120, 90, 65, 40, 55, 85, 115, 85, 55, 40];

    return (
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 p-8 overflow-hidden relative shadow-lg">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full border-4 border-cyan-300 animate-ping"></div>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-28 w-28 rounded-full border-4 border-cyan-200 animate-pulse"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 flex items-end justify-center gap-2 h-36">
            {bars.map((h, index) => (
              <span
                key={index}
                className="w-1.5 bg-white/90 rounded-full animate-pulse"
                style={{
                  height: `${h}px`,
                  animationDelay: `${index * 0.08}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center">
            <div className="absolute -top-6 h-28 w-28 rounded-full border-4 border-cyan-300/60 animate-ping"></div>
            <div className="absolute -top-2 h-20 w-20 rounded-full border-4 border-cyan-200/70 animate-pulse"></div>

            <div className="relative h-24 w-20 rounded-t-[2.5rem] rounded-b-2xl bg-gray-700 shadow-xl flex items-center justify-center border-4 border-gray-600">
              <div className="absolute top-3 h-10 w-10 rounded-full bg-gray-600 border border-gray-500"></div>
              <div className="absolute bottom-5 h-4 w-4 rounded-full border-2 border-cyan-300"></div>
            </div>

            <div className="h-12 w-3 bg-gray-800"></div>
            <div className="h-4 w-24 rounded-full bg-gray-700 shadow-md"></div>
          </div>

          <p className="mt-6 text-white text-lg font-bold tracking-wide">
            Listening to Emergency Voice Command...
          </p>
        </div>
      </div>
    );
  };

  const firstMatchedDonor = responseData?.matched_donors?.[0];

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold">Emergency Blood Response Center</h2>
            <p className="text-red-100 mt-2 max-w-3xl">
              Create emergency requests, perform smart donor allocation, track donor
              acceptance, monitor SMS and call status, and manage voice-triggered
              emergency workflows from a single hospital operations console.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
              <p className="text-xs text-red-100">Workflow</p>
              <p className="font-semibold">Live Monitoring</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
              <p className="text-xs text-red-100">Alerts</p>
              <p className="font-semibold">SMS + Call</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
              <p className="text-xs text-red-100">Matching</p>
              <p className="font-semibold">AI Assisted</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3">
              <p className="text-xs text-red-100">Mode</p>
              <p className="font-semibold">Hospital Control</p>
            </div>
          </div>
        </div>
      </div>

      {pageMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-2xl shadow-sm">
          {pageMessage}
        </div>
      )}

      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl shadow-sm">
          {pageError}
        </div>
      )}

      <div className="bg-white border rounded-3xl shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-semibold text-gray-800">
              Emergency Request Form
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Submit a new emergency request and trigger smart donor matching.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium">
              Emergency Match
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              Smart Allocation
            </span>
            <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium">
              Broadcast Ready
            </span>
          </div>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blood Group
            </label>
            <select
              name="blood_group"
              value={formData.blood_group}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300"
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required Units
            </label>
            <input
              type="number"
              name="required_units"
              value={formData.required_units}
              onChange={handleChange}
              placeholder="Enter required units"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Enter city"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="Enter state"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            >
              {loading ? "Processing..." : "Smart Allocate Emergency"}
            </button>

            <button
              type="button"
              onClick={handleBroadcast}
              disabled={broadcastLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            >
              {broadcastLoading ? "Broadcasting..." : "Trigger Emergency Broadcast"}
            </button>
          </div>
        </form>
      </div>

      {responseData && (
        <div className="bg-white border rounded-3xl p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-2xl font-semibold text-red-700">
                Allocation Result
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Live allocation, donor communication, and emergency response summary.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                SMS Tracking
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
                Auto Calling
              </span>
              <span className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">
                Donor Response
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border bg-red-50 p-5">
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-xl font-bold text-red-700 mt-1">
                {responseData.status || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl border bg-blue-50 p-5">
              <p className="text-sm text-gray-500">Matched Units</p>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {responseData.matched_units ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border bg-amber-50 p-5">
              <p className="text-sm text-gray-500">Fastest ETA</p>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {responseData.fastest_eta_minutes ?? "N/A"} min
              </p>
            </div>

            <div className="rounded-2xl border bg-green-50 p-5">
              <p className="text-sm text-gray-500">Communication Status</p>
              <p className="text-sm font-semibold text-green-700 mt-1">
                {communicationStatus || "Awaiting communication results"}
              </p>
            </div>
          </div>

          {responseData.message && (
            <div className="mb-6 rounded-2xl border bg-gray-50 p-5">
              <p className="text-sm text-gray-500 mb-1">System Message</p>
              <p className="font-medium text-gray-800">{responseData.message}</p>
            </div>
          )}

          {responseData.matched_donors && responseData.matched_donors.length > 0 ? (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                Matched Donors
              </h4>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {responseData.matched_donors.map((donor, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h5 className="text-lg font-bold text-gray-900">
                          {donor.full_name || `Donor ${donor.id || donor.donor_id || "-"}`}
                        </h5>
                        <p className="text-sm text-gray-500 mt-1">
                          {donor.blood_group || "-"} • {donor.city || "-"},{" "}
                          {donor.state || "-"}
                        </p>
                      </div>

                      <span className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium">
                        Priority Candidate
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-gray-500">Readiness Score</p>
                        <p className="font-bold text-purple-700 mt-1">
                          {donor.readiness_score ?? "N/A"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-gray-500">Priority Score</p>
                        <p className="font-bold text-blue-700 mt-1">
                          {donor.priority_score ?? "N/A"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-gray-500">ETA</p>
                        <p className="font-bold text-amber-700 mt-1">
                          {donor.eta_minutes ?? "N/A"} min
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-gray-500">Distance Level</p>
                        <p className="font-bold text-indigo-700 mt-1">
                          {donor.distance_level || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-gray-700 mb-5">
                      <p>
                        <span className="font-semibold">Phone:</span>{" "}
                        {donor.phone_number || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Email:</span>{" "}
                        {donor.email || "N/A"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCompleteDonation(donor.id || donor.donor_id)
                      }
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-semibold transition-transform hover:scale-[1.01]"
                    >
                      Complete Donation for This Donor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border bg-yellow-50 p-5 text-yellow-800">
              No direct donors matched yet. You may use emergency broadcast to expand donor outreach.
            </div>
          )}

          {responseData.sms_results && responseData.sms_results.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                SMS / Call Communication Status
              </h4>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {responseData.sms_results.map((item, index) => (
                  <div key={index} className="rounded-3xl border bg-gray-50 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h5 className="font-bold text-gray-900">
                        Donor ID: {item.donor_id || "-"}
                      </h5>

                      <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                        Communication Audit
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold">Phone:</span>{" "}
                        {item.phone_number || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">SMS Status Code:</span>{" "}
                        {item.sms_status_code ?? "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">SMS SID:</span>{" "}
                        {item.sms_sid || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Delivery Status:</span>{" "}
                        {item.delivery_status || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Detailed Status:</span>{" "}
                        {item.detailed_status || "N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">SMS Error:</span>{" "}
                        {item.sms_error || "None"}
                      </p>
                      <p>
                        <span className="font-semibold">Call Result:</span>{" "}
                        {item.call_result ? JSON.stringify(item.call_result) : "Not triggered / N/A"}
                      </p>
                      <p>
                        <span className="font-semibold">Call Error:</span>{" "}
                        {item.call_error || "None"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {firstMatchedDonor && (
            <div className="rounded-3xl border bg-gradient-to-r from-green-50 to-emerald-50 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h4 className="text-xl font-bold text-green-700">
                    Accepted Donor Monitoring Panel
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Once the donor accepts the request on the donor dashboard, hospital staff can track and complete the donation workflow here.
                  </p>
                </div>

                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium w-fit">
                  Real-Time Response Aware
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white p-4 border">
                  <p className="text-sm text-gray-500">Selected Donor</p>
                  <p className="font-bold text-gray-900 mt-1">
                    {firstMatchedDonor.full_name || `Donor ${firstMatchedDonor.id || "-"}`}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 border">
                  <p className="text-sm text-gray-500">Expected ETA</p>
                  <p className="font-bold text-amber-700 mt-1">
                    {firstMatchedDonor.eta_minutes ?? "N/A"} minutes
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 border">
                  <p className="text-sm text-gray-500">Blood Group</p>
                  <p className="font-bold text-red-700 mt-1">
                    {firstMatchedDonor.blood_group || formData.blood_group || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border rounded-3xl shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-semibold text-gray-800">
              Manual Emergency Completion
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Complete a donation directly using donor ID when hospital confirmation is received.
            </p>
          </div>

          <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium w-fit">
            Hospital Completion Control
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Donor ID
            </label>
            <input
              type="number"
              value={completeDonorId}
              onChange={(e) => setCompleteDonorId(e.target.value)}
              placeholder="Enter donor ID to complete donation"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          <button
            type="button"
            onClick={() => handleCompleteDonation(completeDonorId)}
            disabled={completeLoading || !completeDonorId}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-transform hover:scale-[1.02]"
          >
            {completeLoading ? "Completing..." : "Complete Donation"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border shadow-lg bg-white">
        <div className="bg-gradient-to-r from-red-700 via-rose-600 to-orange-500 text-white px-6 py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-3xl">🎤</span>
                Voice Emergency Command Center
              </h3>
              <p className="text-sm text-red-100 mt-1">
                Speak naturally and let JeevaSetu convert your voice into an emergency request.
              </p>
            </div>

            <div
              className={`relative flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold border ${
                isListening
                  ? "bg-red-100 border-red-200 text-red-700"
                  : "bg-white/10 border-white/20 text-white"
              }`}
            >
              {isListening ? (
                <>
                  <span className="absolute left-4 inline-flex h-3 w-3 rounded-full bg-red-500 animate-ping"></span>
                  <span className="relative ml-5">🎤 Listening...</span>
                </>
              ) : (
                "Microphone Ready"
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {!voiceSupported && (
            <div className="mb-5 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-2xl">
              Voice recognition is not supported in this browser. Use Chrome or Edge.
            </div>
          )}

          {voiceError && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl">
              {voiceError}
            </div>
          )}

          {isListening && <VoiceVisualizer />}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
            <button
              type="button"
              onClick={handleStartListening}
              disabled={!voiceSupported || isListening}
              className="rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-4 font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            >
              {isListening ? "Listening..." : "🎤 Start Recording"}
            </button>

            <button
              type="button"
              onClick={handleStopListening}
              disabled={!isListening}
              className="rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white px-6 py-4 font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            >
              ⏹ Stop Recording
            </button>

            <button
              type="button"
              onClick={handleClearTranscript}
              className="rounded-2xl bg-gray-700 hover:bg-gray-800 text-white px-6 py-4 font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            >
              ✨ Clear Voice Session
            </button>
          </div>

          <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-700 mb-2">
              Suggested Command Format
            </p>
            <p className="text-blue-900 text-base">
              “Need O positive blood 5 units in Hyderabad Telangana”
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-3xl border bg-gray-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📝</span>
                <p className="text-sm font-semibold text-gray-700">
                  Final Transcript
                </p>
              </div>

              <textarea
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="Recorded transcript will appear here"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 min-h-[140px] bg-white"
              />
            </div>

            <div className="rounded-3xl border bg-gradient-to-br from-sky-50 to-blue-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔊</span>
                <p className="text-sm font-semibold text-blue-700">
                  Live Recognition Preview
                </p>
              </div>

              <div className="min-h-[140px] rounded-2xl border border-blue-100 bg-white p-4 text-gray-700">
                {interimTranscript || (
                  <span className="text-gray-400">Waiting for speech...</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleVoiceSubmit}
            className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 font-semibold shadow-md transition-transform hover:scale-[1.01]"
          >
            🚨 Send Voice Transcript to Emergency Backend
          </button>

          {voiceResponse && (
            <div className="mt-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-xl">
                  🧠
                </div>
                <div>
                  <h4 className="text-xl font-bold text-blue-700">
                    Voice Emergency Processing Result
                  </h4>
                  <p className="text-sm text-gray-500">
                    Transcript parsed, emergency checked, and broadcast triggered.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">Transcript Sent</p>
                  <p className="font-semibold text-gray-900 leading-relaxed">
                    {voiceResponse.voice_transcript}
                  </p>
                </div>

                <div className="rounded-3xl border bg-red-50 p-5 shadow-sm">
                  <p className="text-sm text-gray-500 mb-3">Parsed Request</p>
                  <div className="space-y-2 text-gray-800">
                    <p>
                      <span className="font-semibold">Blood Group:</span>{" "}
                      {voiceResponse.parsed_request?.blood_group}
                    </p>
                    <p>
                      <span className="font-semibold">Units:</span>{" "}
                      {voiceResponse.parsed_request?.required_units}
                    </p>
                    <p>
                      <span className="font-semibold">City:</span>{" "}
                      {voiceResponse.parsed_request?.city}
                    </p>
                    <p>
                      <span className="font-semibold">State:</span>{" "}
                      {voiceResponse.parsed_request?.state}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border bg-amber-50 p-5 shadow-sm">
                  <p className="text-sm text-gray-500 mb-3">Matching Result</p>
                  <div className="space-y-2 text-gray-800">
                    <p>
                      <span className="font-semibold">Status:</span>{" "}
                      {voiceResponse.result?.status}
                    </p>
                    <p>
                      <span className="font-semibold">Matched Units:</span>{" "}
                      {voiceResponse.result?.matched_units}
                    </p>
                    <p>
                      <span className="font-semibold">Message:</span>{" "}
                      {voiceResponse.result?.message}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5">
                <h4 className="text-lg font-bold text-red-700 mb-3">
                  🚨 Emergency Parsed from Voice
                </h4>

                <div className="grid grid-cols-2 gap-4 text-gray-800">
                  <div>
                    <p className="text-sm text-gray-500">Blood Group</p>
                    <p className="font-bold text-lg">
                      {voiceResponse.parsed_request?.blood_group}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Units Needed</p>
                    <p className="font-bold text-lg">
                      {voiceResponse.parsed_request?.required_units}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">City</p>
                    <p className="font-semibold">
                      {voiceResponse.parsed_request?.city}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">State</p>
                    <p className="font-semibold">
                      {voiceResponse.parsed_request?.state}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border bg-gradient-to-r from-indigo-50 to-blue-50 p-5 shadow-sm">
                <p className="text-lg font-bold text-indigo-700 mb-4">
                  Broadcast Activation
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-gray-800">
                  <div className="rounded-2xl bg-white p-4 border">
                    <p className="text-sm text-gray-500">Broadcast Status</p>
                    <p className="font-bold text-indigo-700 mt-1">
                      {voiceResponse.broadcast?.status}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 border">
                    <p className="text-sm text-gray-500">Scope</p>
                    <p className="font-bold text-blue-700 mt-1">
                      {voiceResponse.broadcast?.broadcast_scope}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 border">
                    <p className="text-sm text-gray-500">Next Step</p>
                    <p className="font-bold text-green-700 mt-1">
                      {voiceResponse.broadcast?.next_step}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 border md:col-span-2 xl:col-span-1">
                    <p className="text-sm text-gray-500">Channels Used</p>
                    <p className="font-semibold text-gray-800 mt-1">
                      {voiceResponse.broadcast?.channels_used?.join(", ")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 border md:col-span-2">
                    <p className="text-sm text-gray-500">Broadcast Message</p>
                    <p className="font-medium text-gray-800 mt-1 whitespace-pre-wrap">
                      {voiceResponse.broadcast?.broadcast_message}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 border md:col-span-2 xl:col-span-1">
                    <p className="text-sm text-gray-500">Timestamp</p>
                    <p className="font-medium text-gray-800 mt-1">
                      {voiceResponse.broadcast?.timestamp}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
                <h4 className="text-lg font-semibold text-yellow-700 mb-3">
                  📢 Broadcast Message Sent
                </h4>

                <p className="text-gray-800 whitespace-pre-wrap">
                  {voiceResponse.broadcast?.broadcast_message}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Emergency;