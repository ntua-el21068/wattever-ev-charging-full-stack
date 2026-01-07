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

// --- Συνάρτηση για χρωματισμό πινέζας ---
const getIcon = (status) => {
    let filter = "";
    // AVAILABLE -> Πράσινο
    if (status === 'AVAILABLE') filter = "hue-rotate(140deg) brightness(1.2)"; 
    // CHARGING -> Μπλε
    else if (status === 'CHARGING') filter = "hue-rotate(200deg) brightness(1.5)"; 
    // RESERVED -> Πορτοκαλί (Κρατημένο)
    else if (status === 'RESERVED') filter = "hue-rotate(30deg) saturate(3)"; 
    // Άλλο -> Γκρι
    else filter = "grayscale(100%) brightness(0.5)"; 

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
    // Ανανέωση κάθε 10 δευτερόλεπτα για να βλέπουμε αλλαγές status
    const interval = setInterval(fetchPoints, 10000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full relative z-0"> {/* z-0 για να μην καλύπτει το Navbar */}
      <MapContainer center={[37.9838, 23.7275]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point) => (
          <Marker 
            key={point.pointid} 
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
                      point.status === 'available' || point.status === 'AVAILABLE' ? 'text-green-600' : 
                      point.status === 'reserved' || point.status === 'RESERVED' ? 'text-orange-500' : 
                      point.status === 'charging' || point.status === 'CHARGING' ? 'text-blue-600' :
                      'text-red-600'
                  }`}>
                      {point.status.toUpperCase()}
                  </span>
                  <br/>
                  <strong>Ισχύς:</strong> {point.cap} kW
                </div>

                {/* --- ΚΟΥΜΠΙΑ --- */}
                
                {/* 1. ΑΝ ΕΙΝΑΙ ΔΙΑΘΕΣΙΜΟΣ -> Πάμε στη σελίδα Κράτησης */}
                {(point.status === 'AVAILABLE' || point.status === 'available') && (
                  <button 
                      onClick={() => navigate(`/reserve/${point.pointid}`)}
                      className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700 shadow-sm mt-2"
                  >
                      📅 Κράτηση Θέσης
                  </button>
                )}

                {/* 2. ΑΝ ΕΙΝΑΙ KPATHMENOΣ -> Πάμε στη σελίδα Φόρτισης (Για Έναρξη) */}
                {(point.status === 'RESERVED' || point.status === 'reserved') && (
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

                {/* 3. ΑΝ ΦΟΡΤΙΖΕΙ -> Πάμε στη σελίδα Φόρτισης (Για Επίβλεψη/Τερματισμό) */}
                {(point.status === 'CHARGING' || point.status === 'charging') && (
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