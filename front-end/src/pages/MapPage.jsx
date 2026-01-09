import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { Button, Chip } from "@heroui/react";

// --- CSS STYLES ---
const markerStyles = `
  /* 1. MARKERS (Solid Tech Look) */
  .led-marker { display: flex; align-items: center; justify-content: center; }
  .led-core {
    width: 16px; height: 16px; 
    border-radius: 50%; background-color: currentColor;
    border: 2px solid white; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Colors */
  .status-available { color: #10b981; } /* Emerald */
  .status-reserved  { color: #f97316; } /* Orange */
  .status-charging  { color: #d946ef; } /* Fuchsia */
  .status-user      { color: #3b82f6; } /* Blue */

  /* Animations */
  .status-charging .led-core { animation: heartbeat 1.5s infinite; }
  .status-user .led-core { 
      width: 20px; height: 20px; 
      box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.4); 
      z-index: 1000 !important; 
  }

  @keyframes heartbeat {
    0% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.15); filter: brightness(1.2); }
    100% { transform: scale(1); filter: brightness(1); }
  }

  /* 2. UNIFIED CLUSTERS (Glassy Blue Tech) */
  .custom-cluster-marker {
    background: rgba(15, 23, 42, 0.9); /* Darker Slate */
    border: 1px solid rgba(59, 130, 246, 0.5); /* Subtle Blue Border */
    color: white;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    transition: transform 0.2s ease;
  }
  .custom-cluster-marker:hover {
    transform: scale(1.1);
    border-color: #3b82f6;
    background: #1e293b;
  }

  /* 3. POPUP STYLES */
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: transparent !important; box-shadow: none !important; border: none !important; }
  .leaflet-popup-content { margin: 0 !important; }
  .leaflet-popup-close-button { display: none; }
`;

// --- CLUSTER ICON ---
const createClusterCustomIcon = function (cluster) {
  const count = cluster.getChildCount();
  // Σταθερό μέγεθος, δεν θέλουμε να τραβάει την προσοχή, απλά να ομαδοποιεί
  let sizePx = 40; 
  
  return L.divIcon({
    html: `<div class="custom-cluster-marker" style="width: ${sizePx}px; height: ${sizePx}px;">${count}</div>`,
    className: 'custom-cluster-wrapper', 
    iconSize: L.point(sizePx, sizePx, true),
  });
};

const getIcon = (type) => {
    const s = (type || "").toUpperCase();
    let className = "led-marker ";
    if (s === 'AVAILABLE') className += "status-available";
    else if (s === 'RESERVED') className += "status-reserved";
    else if (s === 'CHARGING') className += "status-charging";
    else if (s === 'USER')     className += "status-user";

    return L.divIcon({
        className: 'custom-div-icon', 
        html: `<div class="${className}"><div class="led-core"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10]
    });
};

const isReservedByMe = (point) => false; 

// --- CONTROLS ---
function RecenterControl({ userLocation }) {
    const map = useMap();
    const handleRecenter = () => {
        if (userLocation) map.flyTo([userLocation.lat, userLocation.lon], 16, { duration: 1.2 });
    };
    if (!userLocation) return null;

    return (
        <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'auto', marginBottom: '24px', marginRight: '12px', zIndex: 900 }}>
            <Button 
                isIconOnly 
                onPress={handleRecenter}
                className="bg-blue-600/90 text-white shadow-xl border border-blue-400 p-3 rounded-full w-14 h-14 flex items-center justify-center hover:bg-blue-500"
            >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
            </Button>
        </div>
    );
}

export default function MapPage() {
  const [points, setPoints] = useState([]);
  const [userLocation, setUserLocation] = useState(null); 
  const navigate = useNavigate();

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = markerStyles;
    document.head.appendChild(styleTag);
    return () => document.head.removeChild(styleTag);
  }, []);

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
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition((position) => {
            setUserLocation({
                lat: position.coords.latitude,
                lon: position.coords.longitude
            });
        }, (err) => console.warn(err), { enableHighAccuracy: true });
    }
  }, []);

  return (
    <div className="h-full w-full relative z-0 bg-zinc-900">
      <MapContainer 
        center={[37.9838, 23.7275]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#1e293b' }}
        maxZoom={17} // Το όριο για να μην χαλάει ο Esri
      >
        <TileLayer
          attribution='Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />

        <RecenterControl userLocation={userLocation} />

        {/* --- REALISTIC CLUSTERING SETTINGS --- */}
        <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
            spiderfyOnMaxZoom={true} // Πρέπει να είναι true για να ανοίγουν
            // ΑΛΛΑΓΗ 1: Κάνουμε τις "γραμμές αράχνης" ΑΟΡΑΤΕΣ
            spiderLegPolylineOptions={{ weight: 0, opacity: 0 }} 
            // ΑΛΛΑΓΗ 2: Μικραίνουμε την ακτίνα για να "σπάνε" πιο νωρίς οι ομάδες
            maxClusterRadius={40} 
            showCoverageOnHover={false}
            // ΑΛΛΑΓΗ 3: Ανοίγουν λίγο περισσότερο για να μην πατιούνται
            spiderfyDistanceMultiplier={2} 
        >
            {points.map((point) => (
            <Marker 
                key={point.pointid} 
                position={[parseFloat(point.lat), parseFloat(point.lon)]}
                icon={getIcon(point.status)}
            >
                <Popup className="glass-popup" closeButton={false}>
                     <div className="p-4 min-w-[260px] bg-zinc-950/95 backdrop-blur-md border border-zinc-700 rounded-2xl text-white shadow-2xl">
                        
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-xl text-white tracking-tight">#{point.pointid}</h3>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">{point.providerName || "Station"}</p>
                            </div>
                            <Chip size="sm" variant="flat" classNames={{
                                    base: (point.status||'').toUpperCase() === 'AVAILABLE' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                                          (point.status||'').toUpperCase() === 'CHARGING' ? "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20" :
                                          "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                                    content: "font-bold text-[10px]"
                                }}>
                                {(point.status || 'UNKNOWN').toUpperCase()}
                            </Chip>
                        </div>

                        {/* Specs */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex flex-col items-center justify-center">
                                <span className="text-zinc-500 uppercase text-[9px] font-bold mb-1">Power</span>
                                <div className="flex items-baseline">
                                    <span className="font-bold text-xl text-white">{point.cap}</span>
                                    <span className="text-xs text-zinc-500 ml-1">kW</span>
                                </div>
                            </div>
                            <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex flex-col items-center justify-center">
                                <span className="text-zinc-500 uppercase text-[9px] font-bold mb-1">Price</span>
                                <div className="flex items-baseline">
                                    <span className="font-bold text-xl text-white">{(point.kwhprice || 0.30).toFixed(2)}</span>
                                    <span className="text-xs text-zinc-500 ml-1">€</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        {(point.status || '').toUpperCase() === 'AVAILABLE' && (
                            <Button onPress={() => navigate(`/reserve/${point.pointid}`)} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 rounded-xl" size="md">Book Now</Button>
                        )}
                        {(point.status || '').toUpperCase() === 'RESERVED' && (
                            <div className="space-y-2">
                                {isReservedByMe(point) ? (
                                    <>
                                    <div className="text-center text-[10px] text-orange-300 font-medium">Your Reservation</div>
                                    <Button onPress={() => navigate(`/charging/${point.pointid}`)} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold rounded-xl" size="md">Start Charging</Button>
                                    </>
                                ) : (
                                    <Button disabled className="w-full bg-zinc-800 text-zinc-500 border border-zinc-700 rounded-xl" size="md">Reserved</Button>
                                )}
                                <Button onPress={() => navigate(`/charging/${point.pointid}`)} className="w-full bg-zinc-800/50 text-orange-500/70 text-xs border border-orange-500/10 rounded-xl" size="sm" variant="flat">Dev Start</Button>
                            </div>
                        )}
                        {(point.status || '').toUpperCase() === 'CHARGING' && (
                            <Button onPress={() => navigate(`/charging/${point.pointid}`)} className="w-full bg-gradient-to-r from-fuchsia-700 to-purple-600 text-white font-bold animate-pulse rounded-xl" size="md">Live Monitor</Button>
                        )}
                    </div>
                </Popup>
            </Marker>
            ))}
        </MarkerClusterGroup>

        {/* USER MARKER */}
        {userLocation && (
            <Marker 
                position={[userLocation.lat, userLocation.lon]} 
                icon={getIcon('USER')}
                zIndexOffset={10000} 
            >
                <Popup className="glass-popup">
                    <div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg border border-blue-400 tracking-wide">
                        YOU
                    </div>
                </Popup>
            </Marker>
        )}

      </MapContainer>
    </div>
  );
}