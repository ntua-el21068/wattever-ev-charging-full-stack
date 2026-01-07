import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';


const getIcon = (status) => {
    let hue = 0; // Blue (Default)
    if (status === 'AVAILABLE') hue = 260; // Greenish
    if (status === 'RESERVED') hue = 0;    // Red (Standard Marker is Blue, we filter it)
    if (status === 'CHARGING') hue = 40;   // Orange/Yellow

    return new L.Icon({
        iconUrl: iconMarker,
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: `marker-${status}` // Θα το φτιάξουμε με inline style στο div του Marker αν χρειαστεί, ή απλά CSS
    });
};

function App() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserveMinutes, setReserveMinutes] = useState(30);

  
  const fetchPoints = async () => {
    try {
      
      const response = await axios.get('http://localhost:9876/api/points');
      setPoints(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching points:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  
  const handleReserve = async (pointId) => {
    try {
      await axios.post(`http://localhost:9876/api/reserve/${pointId}/${reserveMinutes}`);
      alert("Επιτυχία! Ο φορτιστής δεσμεύτηκε.");
      fetchPoints(); // Refresh Map
    } catch (err) {
      alert("Σφάλμα κράτησης: " + (err.response?.data?.detail || err.message));
    }
  };

  
  const handleStartCharging = async (pointId) => {
      try {
          // Hardcoded vehicle_id για το demo
          await axios.post(`http://localhost:9876/api/start_charging/${pointId}/VEH_001`);
          alert("Η φόρτιση ξεκίνησε!");
          fetchPoints();
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ padding: '15px', background: '#2c3e50', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>🔌 WATTever App</h2>
        <div>Points: {points.length}</div>
      </header>

      {/* Map */}
      <div style={{ flex: 1 }}>
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
                  <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{point.pointid}</h3>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Κατάσταση: </strong> 
                    <span style={{ 
                        color: point.status === 'AVAILABLE' ? 'green' : 
                               point.status === 'RESERVED' ? 'orange' : 
                               point.status === 'CHARGING' ? 'blue' : 'red',
                        fontWeight: 'bold'
                    }}>
                        {point.status}
                    </span>
                    <br/>
                    <strong>Τιμή:</strong> {point.kwhprice} €/kWh
                  </div>

                  {/* UI Λογική: Τι κουμπιά δείχνουμε ανάλογα με το status */}
                  
                  {point.status === 'AVAILABLE' && (
                    <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                        <label>Διάρκεια Κράτησης:</label>
                        <div style={{ display: 'flex', gap: '5px', margin: '5px 0' }}>
                            {[15, 30].map(m => (
                                <button 
                                    key={m} 
                                    onClick={() => setReserveMinutes(m)}
                                    style={{ 
                                        background: reserveMinutes === m ? '#2c3e50' : '#ddd',
                                        color: reserveMinutes === m ? 'white' : 'black',
                                        border: 'none', padding: '5px', cursor: 'pointer', flex: 1
                                    }}
                                >
                                    {m}'
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => handleReserve(point.pointid)}
                            style={{ width: '100%', background: '#27ae60', color: 'white', border: 'none', padding: '8px', cursor: 'pointer', borderRadius: '4px' }}
                        >
                            Δέσμευση
                        </button>
                    </div>
                  )}

                  {point.status === 'RESERVED' && (
                      <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px' }}>
                          <p style={{ margin: '0 0 10px 0', fontSize: '0.9em' }}>Φτάσατε στον φορτιστή;</p>
                          <button 
                              onClick={() => handleStartCharging(point.pointid)}
                              style={{ width: '100%', background: '#007bff', color: 'white', border: 'none', padding: '8px', cursor: 'pointer', borderRadius: '4px' }}
                          >
                              🔌 Σύνδεση & Έναρξη
                          </button>
                      </div>
                  )}

                  {point.status === 'CHARGING' && (
                      <div style={{ background: '#d1ecf1', padding: '10px', borderRadius: '5px', textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', marginBottom: '5px' }}>⚡</div>
                          <strong>Φόρτιση σε εξέλιξη...</strong>
                          <button 
                              onClick={() => handleStopCharging(point.pointid)}
                              style={{ width: '100%', background: '#dc3545', color: 'white', border: 'none', padding: '8px', cursor: 'pointer', borderRadius: '4px', marginTop: '10px' }}
                          >
                              Τερματισμός
                          </button>
                      </div>
                  )}

                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;