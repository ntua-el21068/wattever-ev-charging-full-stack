import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Διόρθωση εικονιδίων Leaflet (Standard fix για React) ---
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Συνάρτηση που επιστρέφει το εικονίδιο ανάλογα με το Status (SRS R2.1)
const getIcon = (status) => {
    let className = 'marker-default'; // Μπλε
    
    // Χρωματική κωδικοποίηση (SRS: Πράσινο=Available, Γκρι=Unavailable)
    if (status === 'AVAILABLE') className = 'marker-green';
    else if (status === 'RESERVED') className = 'marker-red';
    else if (status === 'CHARGING') className = 'marker-orange';
    else className = 'marker-gray';

    return new L.Icon({
        iconUrl: iconMarker,
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: className 
    });
};

const MapPage = () => {
  const [points, setPoints] = useState([]);
  const [filterStatus, setFilterStatus] = useState(''); 
  const [reserveMinutes, setReserveMinutes] = useState(30);

  // --- 1. FETCH POINTS (SRS R2.1) ---
  const fetchPoints = async () => {
    try {
      let url = 'http://localhost:8000/api/points';
      if (filterStatus) {
        url += `?status=${filterStatus}`;
      }
      const response = await axios.get(url);
      setPoints(response.data);
    } catch (error) {
      console.error("Error fetching points:", error);
    }
  };

  useEffect(() => {
    fetchPoints();
    // Προαιρετικά: Auto-refresh κάθε 10 δευτερόλεπτα για Live updates
    const interval = setInterval(fetchPoints, 10000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  // --- 2. ΛΕΙΤΟΥΡΓΙΑ ΚΡΑΤΗΣΗΣ (Use Case 1 / SRS R3) ---
  const handleReserve = async (pointId) => {
    try {
      const res = await axios.post(`http://localhost:8000/api/reserve/${pointId}/${reserveMinutes}`);
      alert(`Επιτυχία! Κράτηση μέχρι: ${res.data.reservationendtime}`);
      fetchPoints(); // Ανανέωση χάρτη
    } catch (err) {
      alert("Σφάλμα κράτησης: " + (err.response?.data?.detail || err.message));
    }
  };

  // --- 3. ΛΕΙΤΟΥΡΓΙΑ ΕΝΑΡΞΗΣ ΦΟΡΤΙΣΗΣ (Use Case 2 / SRS R4) ---
  const handleStartCharging = async (pointId) => {
    try {
        // Υποθέτουμε Vehicle ID 'VEH_001' (Hardcoded για το demo)
        await axios.post(`http://localhost:8000/api/start_charging/${pointId}/VEH_001`);
        alert("Η φόρτιση ξεκίνησε! ⚡");
        fetchPoints();
    } catch (err) {
        alert("Αδυναμία έναρξης: " + (err.response?.data?.detail || err.message));
    }
  };

  // --- 4. ΛΕΙΤΟΥΡΓΙΑ ΤΕΡΜΑΤΙΣΜΟΥ (Use Case 2 / SRS R4) ---
  const handleStopCharging = async (pointId) => {
      try {
          const res = await axios.post(`http://localhost:8000/api/stop_charging/${pointId}`);
          alert(`Φόρτιση ολοκληρώθηκε!\nΣύνολο kWh: ${res.data.kwh}\nΚόστος: ${res.data.cost}€`);
          fetchPoints();
      } catch (err) {
          alert("Σφάλμα τερματισμού: " + (err.response?.data?.detail || err.message));
      }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER & FILTERS (SRS R2.2) */}
      <header style={{ padding: '15px', background: '#2c3e50', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>🔌 WATTever Map</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label>Κατάσταση:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="">Όλα</option>
            <option value="available">Διαθέσιμα (Πράσινα)</option>
            <option value="reserved">Κρατημένα (Κόκκινα)</option>
            <option value="charging">Φορτίζουν (Πορτοκαλί)</option>
          </select>
          <button onClick={fetchPoints} style={{ padding: '8px', cursor: 'pointer' }}>Refresh</button>
        </div>
      </header>

      {/* MAP CONTAINER */}
      <div style={{ flex: 1 }}>
        <MapContainer center={[37.9838, 23.7275]} zoom={13} style={{ height: '100%', width: '100%' }}>
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
                <div style={{ minWidth: '200px', textAlign: 'center' }}>
                  <h3 style={{ margin: '5px 0' }}>{point.pointid}</h3>
                  <p>Status: <strong>{point.status}</strong></p>
                  <p>Τιμή: <strong>{point.kwhprice} €/kWh</strong></p>
                  <hr />

                  {/* UI LOGIC: Τι κουμπιά δείχνουμε ανάλογα με το Status */}
                  
                  {/* ΠΕΡΙΠΤΩΣΗ 1: ΔΙΑΘΕΣΙΜΟΣ -> ΔΕΙΞΕ ΚΡΑΤΗΣΗ */}
                  {point.status === 'AVAILABLE' && (
                    <div>
                      <p style={{ fontSize: '0.9em' }}>Επιλογή χρόνου κράτησης:</p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '10px' }}>
                        {[15, 30, 45].map(min => (
                           <button 
                             key={min}
                             onClick={() => setReserveMinutes(min)}
                             style={{ 
                               background: reserveMinutes === min ? '#3498db' : '#ecf0f1',
                               color: reserveMinutes === min ? 'white' : 'black',
                               border: '1px solid #ccc', cursor: 'pointer', padding: '5px'
                             }}
                           >
                             {min}'
                           </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleReserve(point.pointid)}
                        style={{ width: '100%', background: '#27ae60', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', borderRadius: '5px' }}
                      >
                        Δέσμευση
                      </button>
                    </div>
                  )}

                  {/* ΠΕΡΙΠΤΩΣΗ 2: ΚΡΑΤΗΜΕΝΟΣ -> ΔΕΙΞΕ ΕΝΑΡΞΗ (Υποθέτουμε ότι είμαστε ο χρήστης που έκανε την κράτηση) */}
                  {point.status === 'RESERVED' && (
                      <button 
                        onClick={() => handleStartCharging(point.pointid)}
                        style={{ width: '100%', background: '#2980b9', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', borderRadius: '5px' }}
                      >
                        🚙 Άφιξη & Έναρξη Φόρτισης
                      </button>
                  )}

                  {/* ΠΕΡΙΠΤΩΣΗ 3: ΦΟΡΤΙΖΕΙ -> ΔΕΙΞΕ ΤΕΡΜΑΤΙΣΜΟ */}
                  {point.status === 'CHARGING' && (
                      <div style={{ background: '#f39c12', padding: '10px', borderRadius: '5px', color: 'white' }}>
                        <h4>⚡ Φόρτιση σε εξέλιξη...</h4>
                        <div className="pulse">...</div>
                        <button 
                          onClick={() => handleStopCharging(point.pointid)}
                          style={{ width: '100%', background: '#c0392b', color: 'white', padding: '10px', marginTop: '10px', border: 'none', cursor: 'pointer', borderRadius: '5px' }}
                        >
                          Τερματισμός (Stop)
                        </button>
                      </div>
                  )}

                  {/* ΠΕΡΙΠΤΩΣΗ 4: ΕΚΤΟΣ ΛΕΙΤΟΥΡΓΙΑΣ */}
                  {(point.status === 'OUTOFORDER' || point.status === 'OFFLINE') && (
                      <p style={{ color: 'red', fontWeight: 'bold' }}>ΜΗ ΔΙΑΘΕΣΙΜΟΣ</p>
                  )}

                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapPage;