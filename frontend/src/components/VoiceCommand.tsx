import { useState } from "react";

function VoiceCommand() {
  const [command, setCommand] = useState("");

  const handleVoiceTrigger = () => {
    alert(`Voice command received: ${command}`);
  };

  return (
    <div className="mt-8 bg-white border rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">Voice Command Activation</h3>
      <p className="text-sm text-gray-600 mb-4">
        Simulate voice-enabled emergency activation for JeevaSetu.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter voice command"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
        />

        <button
          type="button"
          onClick={handleVoiceTrigger}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Activate Voice Command
        </button>
      </div>
    </div>
  );
}

export default VoiceCommand;