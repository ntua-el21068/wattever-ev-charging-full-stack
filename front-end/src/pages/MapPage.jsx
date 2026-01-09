import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, Input, Card, CardBody } from "@heroui/react";

// --- 1. CSS STYLES ---
const mapStyles = `
  .led-marker { display: flex; align-items: center; justify-content: center; }
  .led-core { width: 22px; height: 22px; border-radius: 50%; background-color: currentColor; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5); }
  .status-available { color: #10b981; } .status-reserved { color: #f97316; } .status-charging { color: #d946ef; } .status-user { color: #3b82f6; }
  .status-charging .led-core { animation: heartbeat 2s infinite; }
  @keyframes heartbeat { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
  .status-user .led-core { width: 24px; height: 24px; box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.4); }
  .custom-cluster-marker { background: rgba(15, 23, 42, 0.95); border: 2px solid rgba(255,255,255,0.2); color: white; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.6); }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: transparent !important; box-shadow: none !important; border: none !important; }
  .leaflet-popup-content { margin: 0 !important; } .leaflet-popup-close-button { display: none; }
`;

// --- 2. LOGIC HELPERS ---

const normalize = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
const getId = (p) => p.charger_id || p.pointid || "Unknown";

// >>> ΝΕΑ ΛΟΓΙΚΗ ΟΝΟΜΑΤΩΝ ΜΕ ΒΑΣΗ ΤΟ ΝΕΟ API <<<
const getChargerTitle = (p) => {
    // 1. Διεύθυνση (station_address από το API)
    if (p.station_address && p.station_address !== "Unknown") return p.station_address;
    // 2. Όνομα Σταθμού (station_name από το API)
    if (p.station_name && p.station_name !== "Unknown") return p.station_name;
    // 3. Fallback
    return `Charger #${getId(p)}`;
};

const getChargerSubtitle = (p) => {
    // Αν ο τίτλος είναι η διεύθυνση και υπάρχει όνομα, δείξε το όνομα
    const title = getChargerTitle(p);
    if (p.station_name && !title.includes(p.station_name) && p.station_name !== "Unknown") return p.station_name;
    return `ID: ${getId(p)}`;
};

// --- 3. ICONS ---
const createClusterIcon = (cluster) => {
  const count = cluster.getChildCount();
  const size = count > 10 ? 48 : 36;
  return L.divIcon({
    html: `<div class="custom-cluster-marker" style="width: ${size}px; height: ${size}px;">${count}</div>`,
    className: 'custom-cluster-wrapper', 
    iconSize: L.point(size, size, true),
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
        iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -10]
    });
};

// --- 4. SEARCH OVERLAY ---
function SearchOverlay({ points, onSelectResult }) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("ALL"); 
    const [showResults, setShowResults] = useState(false);
    const wrapperRef = useRef(null); 

    // Click Outside Logic
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Search Filtering
    const results = useMemo(() => {
        if (!query && filter === 'ALL') return [];
        const q = normalize(query);

        return points.filter(p => {
            const searchableText = normalize(
                `${getId(p)} ${p.station_name || ''} ${p.station_address || ''}`
            );
            const matchesText = searchableText.includes(q);
            
            let matchesCategory = true;
            if (filter === 'AVAILABLE') matchesCategory = (p.status || '').toUpperCase() === 'AVAILABLE';
            if (filter === 'FAST') matchesCategory = parseFloat(p.cap || 0) >= 40; 

            return matchesText && matchesCategory;
        }).slice(0, 5);
    }, [query, filter, points]);

    return (
        <div ref={wrapperRef} className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-[90%] max-w-md flex flex-col gap-2 font-sans">
            <Card className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 shadow-2xl">
                <CardBody className="p-3 gap-3">
                    <Input 
                        placeholder="Search address, station, ID..." 
                        isClearable
                        onClear={() => setQuery("")}
                        startContent={<span className="text-lg">🔍</span>}
                        value={query}
                        onValueChange={setQuery}
                        onFocus={() => setShowResults(true)}
                        classNames={{
                            inputWrapper: "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 group-data-[focus=true]:bg-zinc-800",
                            input: "text-white placeholder:text-zinc-500 font-medium"
                        }}
                    />
                    <div className="flex gap-2">
                        <Chip size="sm" variant={filter === 'ALL' ? "solid" : "bordered"} color="default" className="cursor-pointer border-zinc-600" onClick={() => setFilter('ALL')}>All</Chip>
                        <Chip size="sm" variant={filter === 'AVAILABLE' ? "solid" : "bordered"} color="success" className="cursor-pointer" onClick={() => setFilter(filter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}>Available</Chip>
                        <Chip size="sm" variant={filter === 'FAST' ? "solid" : "bordered"} color="warning" className="cursor-pointer" onClick={() => setFilter(filter === 'FAST' ? 'ALL' : 'FAST')}>Fast ⚡</Chip>
                    </div>
                </CardBody>
            </Card>

            {showResults && results.length > 0 && (
                <Card className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 shadow-xl overflow-hidden animate-appearance-in">
                    <div className="flex flex-col">
                        {results.map((p) => (
                            <button 
                                key={getId(p)}
                                onClick={() => {
                                    onSelectResult(p);
                                    setShowResults(false);
                                    setQuery(getChargerTitle(p)); 
                                }}
                                className="flex items-center justify-between p-3 hover:bg-zinc-800 border-b border-zinc-800/50 last:border-none transition-colors text-left"
                            >
                                <div className="max-w-[70%]">
                                    <div className="text-white font-bold text-sm truncate">{getChargerTitle(p)}</div>
                                    <div className="text-[10px] text-zinc-400 truncate">{getChargerSubtitle(p)}</div>
                                </div>
                                <Chip size="sm" variant="flat" color={(p.status||'').toUpperCase() === 'AVAILABLE' ? "success" : "warning"} className="h-6 text-[10px]">
                                    {(p.status || 'UNKNOWN').toUpperCase()}
                                </Chip>
                            </button>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

// --- 5. SMART MARKER ---
const SmartMarker = ({ point, selectedId, navigate }) => {
    const markerRef = useRef(null);
    const myId = getId(point);

    useEffect(() => {
        if (selectedId === myId && markerRef.current) {
            setTimeout(() => markerRef.current.openPopup(), 500);
        }
    }, [selectedId, myId]);

    const statusColor = (point.status||'').toUpperCase() === 'AVAILABLE' ? "text-emerald-400" : "text-orange-400";
    const icon = L.divIcon({
        className: 'custom-div-icon', 
        html: `<div class="led-marker ${
            (point.status||'').toUpperCase() === 'AVAILABLE' ? "status-available" : 
            (point.status||'').toUpperCase() === 'CHARGING' ? "status-charging" : "status-reserved"
        }"><div class="led-core"></div></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -10]
    });

    return (
        <Marker 
            ref={markerRef}
            position={[parseFloat(point.lat), parseFloat(point.lon)]} 
            icon={icon}
        >
            <Popup className="glass-popup" closeButton={false}>
                <div className="p-4 min-w-[240px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-700 rounded-2xl text-white shadow-2xl">
                    <div className="flex justify-between items-start mb-3">
                        <div className="max-w-[75%]">
                            <h3 className="font-bold text-md text-white leading-tight">{getChargerTitle(point)}</h3>
                            <div className="text-[10px] text-zinc-400 mt-1 truncate">{getChargerSubtitle(point)}</div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 ${statusColor}`}>
                            {(point.status || 'UNKNOWN').toUpperCase()}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-zinc-900/80 p-2 rounded-lg text-center border border-zinc-800">
                            <div className="text-[9px] text-zinc-500 uppercase font-bold">Power</div>
                            <div className="font-bold text-white text-sm">{point.cap} kW</div>
                        </div>
                        <div className="bg-zinc-900/80 p-2 rounded-lg text-center border border-zinc-800">
                            <div className="text-[9px] text-zinc-500 uppercase font-bold">ID</div>
                            <div className="font-bold text-white text-sm">#{myId}</div>
                        </div>
                    </div>

                    {(point.status || '').toUpperCase() === 'AVAILABLE' && (
                        <Button onPress={() => navigate(`/reserve/${myId}`)} className="w-full bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-900/20" size="sm">📅 Book Now</Button>
                    )}
                    {(point.status || '').toUpperCase() === 'RESERVED' && (
                        <Button onPress={() => navigate(`/charging/${myId}`)} className="w-full bg-orange-600 text-white font-bold" size="sm">🔌 Start Charging</Button>
                    )}
                    {(point.status || '').toUpperCase() === 'CHARGING' && (
                         <Button onPress={() => navigate(`/charging/${myId}`)} className="w-full bg-fuchsia-600 text-white font-bold animate-pulse" size="sm">⚡ Monitor</Button>
                    )}
                </div>
            </Popup>
        </Marker>
    );
};

// --- 6. MAIN PAGE ---
export default function MapPage() {
  const [points, setPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  const [userLocation, setUserLocation] = useState(null); 
  const navigate = useNavigate();
  const mapRef = useRef(null); 

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = mapStyles;
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

  useEffect(() => { fetchPoints(); }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        });
    }
  }, []);

  const handleSearchResult = (point) => {
      const id = getId(point);
      setSelectedId(id); 
      if (mapRef.current) {
          mapRef.current.flyTo(
              [parseFloat(point.lat), parseFloat(point.lon)], 
              18, 
              { duration: 1.5 }
          );
      }
  };

  const handleRecenter = () => {
      if (userLocation && mapRef.current) {
          mapRef.current.flyTo([userLocation.lat, userLocation.lon], 16, { duration: 1 });
      }
  };

  const MapClickHandler = () => {
      useMapEvents({ click: () => setSelectedId(null) });
      return null;
  };

  return (
    <div className="h-full w-full relative z-0 bg-zinc-950 overflow-hidden">
      <SearchOverlay points={points} onSelectResult={handleSearchResult} />

      <div className="absolute bottom-8 right-4 z-[900]">
          <Button isIconOnly onPress={handleRecenter} className="bg-blue-600 text-white shadow-xl border border-blue-400 p-3 rounded-full w-14 h-14 hover:bg-blue-500">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          </Button>
      </div>

      <MapContainer 
        ref={mapRef}
        center={[37.9838, 23.7275]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#1e293b' }}
        maxZoom={18}
        zoomControl={false} 
      >
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={20} />
        <MapClickHandler />

        <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={(cluster) => L.divIcon({ html: `<div class="custom-cluster-marker" style="width: 40px; height: 40px;">${cluster.getChildCount()}</div>`, className: 'custom-cluster-wrapper', iconSize: L.point(40, 40) })}
            disableClusteringAtZoom={16}
            spiderfyOnMaxZoom={false}
            maxClusterRadius={45} 
            showCoverageOnHover={false}
        >
            {points.map((point) => (
                <SmartMarker key={getId(point)} point={point} selectedId={selectedId} navigate={navigate} />
            ))}
        </MarkerClusterGroup>

        {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={L.divIcon({ className: 'custom-div-icon', html: `<div class="led-marker status-user"><div class="led-core"></div></div>`, iconSize: [24, 24] })} zIndexOffset={10000}>
                <Popup className="glass-popup"><div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full">YOU</div></Popup>
            </Marker>
        )}
      </MapContainer>
    </div>
  );
}