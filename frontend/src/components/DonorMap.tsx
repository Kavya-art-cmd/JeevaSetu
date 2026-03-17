import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { LatLngTuple } from "leaflet";

type DonorLocation = {
  name: string;
  position: LatLngTuple;
};

function DonorMap() {
  const center: LatLngTuple = [17.385044, 78.486671];

  const donors: DonorLocation[] = [
    { name: "Donor 1", position: [17.385044, 78.486671] },
  ];

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 mt-10">
      <h3 className="text-lg font-semibold mb-4">Donor Location Map</h3>

      <MapContainer center={center} zoom={10} style={{ height: "400px", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {donors.map((donor, index) => (
          <Marker key={index} position={donor.position}>
            <Popup>{donor.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default DonorMap;