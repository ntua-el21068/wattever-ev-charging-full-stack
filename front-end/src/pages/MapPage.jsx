// src/pages/MapPage.jsx
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useNavigate } from 'react-router-dom'; // Import για πλοήγηση

// --- Διόρθωση Εικονιδίων Leaflet ---
const DefaultIcon = L.icon({
    iconUrl: iconMarker,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Συνάρτηση για χρωματισμό πινέζας (Self-contained) ---
const getIcon = (status) => {
    let filter = "";
    // Λαμβάνουμε υπόψη και τα μικρά και τα κεφαλαία γράμματα για ασφάλεια
    const s = status ? status.toUpperCase() : "";

    if (s === 'AVAILABLE') filter = "hue-rotate(140deg) brightness(1.2)"; // Πράσινο
    else if (s === 'CHARGING') filter = "hue-rotate(200deg) brightness(1.5)"; // Μπλε
    else if (s === 'RESERVED') filter = "hue-rotate(30deg) saturate(3)"; // Πορτοκαλί
    else filter = "grayscale(100%) brightness(0.5)"; // Γκρι

    return L.divIcon({
        className: 'custom-marker',
        html: `<img src="${iconMarker}" style="width:25px; height:41px; filter: ${filter};" />`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    });
};

export default function MapPage() {
  const [points, setPoints] = useState([]);
  const navigate = useNavigate(); // Hook για πλοήγηση

  // Fetch Points από το σωστό Port 9876
  const fetchPoints = async () => {
    try {
      const response = await axios.get('http://localhost:9876/api/points');
      setPoints(response.data);
    } catch (error) {
      console.error("Error fetching points:", error);
    }
  };

  useEffect(() => {
    fetchPoints();
    // Χωρίς setInterval για να μην αναβοσβήνει
  }, []);

  return (
    <div className="h-full w-full relative z-0"> 
      <MapContainer center={[37.9838, 23.7275]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point) => (
          <Marker 
            key={point.pointid} 
            // ΠΡΟΣΟΧΗ: Εδώ είναι το μυστικό! parseFloat γιατί η βάση στέλνει strings
            position={[parseFloat(point.lat), parseFloat(point.lon)]}
            icon={getIcon(point.status)}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                <h3 className="font-bold text-lg mb-1 text-[#2c3e50]">Φορτιστής #{point.pointid}</h3>
                <p className="text-xs text-gray-500 mb-2">{point.providerName || "WATTever"}</p>
                
                <div className="mb-3">
                  <strong>Κατάσταση: </strong> 
                  <span className={`font-bold ${
                      (point.status || '').toUpperCase() === 'AVAILABLE' ? 'text-green-600' : 
                      (point.status || '').toUpperCase() === 'RESERVED' ? 'text-orange-500' : 
                      (point.status || '').toUpperCase() === 'CHARGING' ? 'text-blue-600' :
                      'text-red-600'
                  }`}>
                      {(point.status || 'UNKNOWN').toUpperCase()}
                  </span>
                  <br/>
                  <strong>Ισχύς:</strong> {point.cap} kW
                </div>

                {/* --- ΚΟΥΜΠΙΑ ΠΛΟΗΓΗΣΗΣ --- */}
                
                {/* 1. AVAILABLE -> Σελίδα Κράτησης */}
                {(point.status || '').toUpperCase() === 'AVAILABLE' && (
                  <button 
                      onClick={() => navigate(`/reserve/${point.pointid}`)}
                      className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700 shadow-sm mt-2"
                  >
                      📅 Κράτηση Θέσης
                  </button>
                )}

                {/* 2. RESERVED -> Σελίδα Φόρτισης (Έναρξη) */}
                {(point.status || '').toUpperCase() === 'RESERVED' && (
                    <div className="bg-orange-50 p-2 rounded border border-orange-200 mt-2">
                        <p className="text-xs mb-2 text-center text-orange-800">Η θέση είναι κρατημένη.</p>
                        <button 
                            onClick={() => navigate(`/charging/${point.pointid}`)}
                            className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 shadow-sm"
                        >
                            🔌 Σύνδεση & Έναρξη
                        </button>
                    </div>
                )}

                {/* 3. CHARGING -> Σελίδα Φόρτισης (Επίβλεψη) */}
                {(point.status || '').toUpperCase() === 'CHARGING' && (
                    <button 
                        onClick={() => navigate(`/charging/${point.pointid}`)}
                        className="w-full bg-blue-500 text-white p-2 rounded font-bold animate-pulse mt-2"
                    >
                        ⚡ Προβολή Φόρτισης
                    </button>
                )}

              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}