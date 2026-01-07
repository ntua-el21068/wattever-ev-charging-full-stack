// src/pages/MapPage.jsx
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useNavigate } from 'react-router-dom'; // Χρησιμοποιούμε useNavigate για να αλλάξουμε σελίδα προγραμματιστικά

const getIcon = (status) => {
    // Η λογική χρωμάτων της φίλης σου
    let hue = 0; 
    if (status === 'AVAILABLE') hue = 260; // Greenish (hue-rotate)
    if (status === 'RESERVED') hue = 0;    // Original Blue turned Reddish via CSS logic in index.css? 
    // Σημείωση: Στο index.css έχουμε βάλει κλάσεις .marker-AVAILABLE κλπ, οπότε θα παίξει από εκεί.

    return new L.Icon({
        iconUrl: iconMarker,
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: `marker-${status}` // Αυτό παίρνει χρώμα από το src/index.css
    });
};

export default function MapPage() {
  const [points, setPoints] = useState([]);
  const [reserveMinutes, setReserveMinutes] = useState(30);
  const navigate = useNavigate(); // Για να σε πηγαίνουμε στη σελίδα φόρτισης

  // 1. Fetch Points (Ακριβώς όπως της φίλης σου)
  const fetchPoints = async () => {
    try {
      const response = await axios.get('http://localhost:9876/api/points');
      setPoints(response.data);
    } catch (error) {
      console.error("Error fetching points:", error);
      // Εδώ δεν βάζω mock data για να δεις ακριβώς τι επιστρέφει ο server
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  // 2. Handle Reserve
  const handleReserve = async (pointId) => {
    try {
      await axios.post(`http://localhost:9876/api/reserve/${pointId}/${reserveMinutes}`);
      alert("Επιτυχία! Ο φορτιστής δεσμεύτηκε.");
      fetchPoints(); 
    } catch (err) {
      alert("Σφάλμα κράτησης: " + (err.response?.data?.detail || err.message));
    }
  };

  // 3. Handle Start Charging (Εδώ έκανα μια μικρή βελτίωση: σε πάει στη σελίδα Charging)
  const handleStartCharging = async (pointId) => {
      try {
          // Καλεί το API της φίλης σου
          await axios.post(`http://localhost:9876/api/start_charging/${pointId}/VEH_001`);
          alert("Η φόρτιση ξεκίνησε!");
          fetchPoints();
          
          // ΣΕ ΠΑΕΙ ΣΤΗΝ ΟΘΟΝΗ ΦΟΡΤΙΣΗΣ ΠΟΥ ΦΤΙΑΞΑΜΕ
          navigate(`/charging/${pointId}`);
          
      } catch (err) {
          alert("Σφάλμα εκκίνησης: " + (err.response?.data?.detail || err.message));
      }
  };

  // 4. Handle Stop Charging
  const handleStopCharging = async (pointId) => {
      try {
          const res = await axios.post(`http://localhost:9876/api/stop_charging/${pointId}`);
          alert(`Η φόρτιση ολοκληρώθηκε! Κόστος: ${res.data.cost}€, Ενέργεια: ${res.data.kwh} kWh`);
          fetchPoints();
      } catch (err) {
          alert("Σφάλμα τερματισμού: " + (err.response?.data?.detail || err.message));
      }
  };

  return (
    <div className="h-full w-full">
      <MapContainer center={[37.9838, 23.7275]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point) => (
          <Marker 
            key={point.pointid} 
            position={[point.lat, point.lon]}
            icon={getIcon(point.status)}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'Arial, sans-serif' }}>
                <h3 className="font-bold text-lg mb-2 text-[#2c3e50]">Φορτιστής #{point.pointid}</h3>
                
                <div className="mb-3">
                  <strong>Κατάσταση: </strong> 
                  <span className={`font-bold ${
                      point.status === 'AVAILABLE' ? 'text-green-600' : 
                      point.status === 'RESERVED' ? 'text-orange-500' : 
                      'text-red-600'
                  }`}>
                      {point.status}
                  </span>
                  <br/>
                  <strong>Τιμή:</strong> {point.kwhprice} €/kWh
                </div>

                {/* Κουμπιά (Ακριβώς η λογική της φίλης σου) */}
                
                {point.status === 'AVAILABLE' && (
                  <div className="bg-gray-100 p-2 rounded">
                      <label className="text-sm">Διάρκεια Κράτησης:</label>
                      <div className="flex gap-1 my-2">
                          {[15, 30].map(m => (
                              <button 
                                  key={m} 
                                  onClick={() => setReserveMinutes(m)}
                                  className={`flex-1 p-1 text-sm border rounded ${
                                      reserveMinutes === m ? 'bg-[#2c3e50] text-white' : 'bg-white text-black'
                                  }`}
                              >
                                  {m}'
                              </button>
                          ))}
                      </div>
                      <button 
                          onClick={() => handleReserve(point.pointid)}
                          className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700"
                      >
                          Δέσμευση
                      </button>
                  </div>
                )}

                {point.status === 'RESERVED' && (
                    <div className="bg-orange-50 p-2 rounded border border-orange-200">
                        <p className="text-sm mb-2">Φτάσατε στον φορτιστή;</p>
                        <button 
                            onClick={() => handleStartCharging(point.pointid)}
                            className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700"
                        >
                            🔌 Σύνδεση & Έναρξη
                        </button>
                    </div>
                )}

                {point.status === 'CHARGING' && (
                    <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                        <div className="text-xl animate-pulse">⚡</div>
                        <strong>Φόρτιση σε εξέλιξη...</strong>
                        <button 
                            onClick={() => handleStopCharging(point.pointid)}
                            className="w-full bg-red-600 text-white p-2 rounded font-bold mt-2 hover:bg-red-700"
                        >
                            Τερματισμός
                        </button>
                        
                        {/* Κουμπί για να δεις την ωραία οθόνη που φτιάξαμε */}
                        <button
                             onClick={() => navigate(`/charging/${point.pointid}`)}
                             className="w-full mt-2 text-xs text-blue-600 underline"
                        >
                            Προβολή Οθόνης Φόρτισης
                        </button>
                    </div>
                )}

              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}