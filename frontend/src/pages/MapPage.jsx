import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Card, CardBody, Chip } from "@heroui/react";
import API_BASE_URL from '../config';

const TargetIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="22" y1="12" x2="18" y2="12"></line>
    <line x1="6" y1="12" x2="2" y2="12"></line>
    <line x1="12" y1="6" x2="12" y2="2"></line>
    <line x1="12" y1="22" x2="12" y2="18"></line>
    <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
  </svg>
);

const mapStyles = `
  .led-marker { display: flex; align-items: center; justify-content: center; }
  .led-core { width: 22px; height: 22px; border-radius: 50%; background-color: currentColor; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5); }
  .status-available { color: #10b981; } 
  .status-reserved { color: #f97316; } 
  .status-charging { color: #d946ef; }
  .status-charging .led-core { animation: heartbeat 2s infinite; }
  @keyframes heartbeat { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
  .user-pulse-marker { position: relative; display: flex; align-items: center; justify-content: center; }
  .user-dot { width: 16px; height: 16px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; z-index: 2; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
  .user-pulse-ring { position: absolute; width: 40px; height: 40px; background-color: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: 1; }
  @keyframes radar-ping { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
  .custom-cluster-marker { background: rgba(16, 185, 129, 0.9); border: none; color: black; font-weight: 800; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); backdrop-filter: blur(4px); }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: transparent !important; box-shadow: none !important; border: none !important; }
  .leaflet-popup-content { margin: 0 !important; } .leaflet-popup-close-button { display: none; }
`;

const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const getId = (p) => String(p.charger_id || p.pointid || "Unknown");
const getChargerTitle = (p) => p.station_address || p.station_name || `Charger #${getId(p)}`;

function SearchOverlay({ points, onSelectResult }) {
    const [query, setQuery] = useState("");
    const [showResults, setShowResults] = useState(false);
    const results = useMemo(() => {
        if (!query) return [];
        return points.filter(p => (getChargerTitle(p) + getId(p)).toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    }, [query, points]);

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-[90%] max-w-md font-sans">
            <Card className="bg-zinc-900/95 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <CardBody className="p-2">
                    <Input placeholder="Search stations..." isClearable onClear={() => setQuery("")} value={query} onValueChange={setQuery} onFocus={() => setShowResults(true)} classNames={{ inputWrapper: "bg-zinc-800", input: "text-white" }}/>
                </CardBody>
            </Card>
            {showResults && results.length > 0 && (
                <Card className="mt-2 bg-zinc-900/95 border border-zinc-700 backdrop-blur-md">
                    <div className="flex flex-col">
                        {results.map((p) => (
                            <button key={getId(p)} onClick={() => { onSelectResult(p); setShowResults(false); }} className="p-3 hover:bg-zinc-800 text-left text-white border-b border-zinc-800 text-sm">{getChargerTitle(p)}</button>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

const SmartMarker = ({ point, selectedId, navigate, userLocation, activeReservationId }) => {
    const markerRef = useRef(null);
    const myId = getId(point);
    const distance = userLocation ? getDistanceFromLatLonInM(userLocation.lat, userLocation.lon, parseFloat(point.lat), parseFloat(point.lon)) : Infinity;
    const isReservedByMe = String(activeReservationId) === myId;
    const canCharge = distance < 500 || isReservedByMe;

    useEffect(() => {
        if (selectedId === myId && markerRef.current) {
            const tryOpen = () => { if (markerRef.current) markerRef.current.openPopup(); };
            tryOpen();
            const timer = setTimeout(tryOpen, 300);
            return () => clearTimeout(timer);
        }
    }, [selectedId, myId]);

    const statusColor = (point.status||'').toUpperCase() === 'AVAILABLE' ? "status-available" : (point.status||'').toUpperCase() === 'RESERVED' ? "status-reserved" : "status-charging";
    const icon = L.divIcon({ className: 'custom-div-icon', html: `<div class="led-marker ${statusColor}"><div class="led-core"></div></div>`, iconSize: [24, 24] });

    return (
        <Marker ref={markerRef} position={[parseFloat(point.lat), parseFloat(point.lon)]} icon={icon}>
            <Popup className="glass-popup" closeButton={false} autoPan={true}>
                <div className="p-5 bg-black/90 border border-zinc-800 rounded-2xl text-white min-w-[240px] shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                    <div className="mb-4 border-b border-zinc-800 pb-3">
                        <h3 className="font-bold text-sm leading-tight text-white mb-1">{getChargerTitle(point)}</h3>
                        <div className="flex justify-between items-center"><span className="text-[10px] text-zinc-500 font-mono">ID: {myId}</span><Chip size="sm" variant="dot" color={(point.status||'').toUpperCase() === 'AVAILABLE' ? "success" : "warning"} className="h-5 text-[10px] border-0">{point.status}</Chip></div>
                        {userLocation && (<div className="mt-1 text-[10px] text-blue-400 font-bold">{distance < 1000 ? `${Math.round(distance)}m away` : `${(distance/1000).toFixed(1)}km away`}</div>)}
                    </div>
                    <div className="flex flex-col items-center justify-center bg-zinc-900 rounded-xl p-3 mb-4 border border-zinc-800"><span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Max Power</span><div className="flex items-baseline gap-1"><span className="text-3xl font-black text-white tracking-tighter">{point.cap}</span><span className="text-sm font-bold text-zinc-500">kW</span></div></div>
                    {(point.status || '').toUpperCase() === 'AVAILABLE' && (<div className="flex gap-2"><Button onPress={() => navigate(`/reserve/${myId}`, { state: { fromMap: true } })} size="sm" variant="flat" className={`bg-zinc-800 font-bold text-white ${canCharge ? 'flex-1' : 'w-full'}`}>Reserve</Button>{canCharge && <Button onPress={() => navigate(`/charging/${myId}`)} size="sm" className="flex-1 bg-green-500 font-bold text-black shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-pulse">Charge ⚡</Button>}</div>)}
                    {(point.status || '').toUpperCase() === 'RESERVED' && (isReservedByMe ? (<Button onPress={() => navigate(`/charging/${myId}`)} size="sm" className="w-full bg-orange-500 font-bold text-white animate-pulse">Start Session</Button>) : (<Button disabled size="sm" className="w-full bg-zinc-800 text-zinc-500 font-bold">Reserved</Button>))}
                    {(point.status || '').toUpperCase() === 'CHARGING' && (<Button onPress={() => navigate(`/charging/${myId}`)} size="sm" className="w-full bg-purple-600 font-bold text-white">Monitor</Button>)}
                </div>
            </Popup>
        </Marker>
    );
};

export default function MapPage() {
  const [points, setPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  const [userLocation, setUserLocation] = useState(null); 
  const [activeReservationId, setActiveReservationId] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const mapRef = useRef(null); 

  useEffect(() => {
    const styleTag = document.createElement("style"); styleTag.innerHTML = mapStyles; document.head.appendChild(styleTag);
    return () => document.head.removeChild(styleTag);
  }, []);

  useEffect(() => {
    const fetchPoints = async () => { try { const response = await axios.get(`${API_BASE_URL}/api/points`); setPoints(response.data); } catch (error) { console.error(error); } };
    fetchPoints();
    const fetchReservation = async () => { try { const res = await axios.get(`${API_BASE_URL}/api/user/active_reservation`); if (res.data && res.data.pointid) setActiveReservationId(String(res.data.pointid)); else setActiveReservationId(null); } catch(e) { console.error(e); } };
    fetchReservation();
  }, []);

  useEffect(() => {
    if (location.state && location.state.targetId && points.length > 0) {
        const targetId = String(location.state.targetId);
        const point = points.find(p => getId(p) === targetId);
        if (point && mapRef.current) {
            mapRef.current.flyTo([parseFloat(point.lat), parseFloat(point.lon)], 18, { duration: 1.5 });
            const map = mapRef.current;
            const onMoveEnd = () => { setSelectedId(targetId); map.off('moveend', onMoveEnd); };
            map.on('moveend', onMoveEnd);
        }
    }
  }, [location, points]);

  useEffect(() => { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((position) => { setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude }); }); } }, []);

  const handleSearchResult = (point) => {
      const id = getId(point);
      if (mapRef.current) {
          mapRef.current.flyTo([parseFloat(point.lat), parseFloat(point.lon)], 18, { duration: 1.5 });
          setTimeout(() => setSelectedId(id), 1600);
      }
  };

  return (
    <div className="h-full w-full relative bg-zinc-950 overflow-hidden">
      <SearchOverlay points={points} onSelectResult={handleSearchResult} />
      <div className="absolute bottom-6 right-4 z-[900]">
          <Button isIconOnly onPress={() => userLocation && mapRef.current.flyTo([userLocation.lat, userLocation.lon], 16)} className="bg-zinc-900 border border-zinc-700 text-white rounded-full w-14 h-14 shadow-2xl hover:scale-110 hover:border-white transition-all"><TargetIcon /></Button>
      </div>
      <MapContainer ref={mapRef} center={[37.9838, 23.7275]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <useMapEvents click={() => setSelectedId(null)} />
        <MarkerClusterGroup chunkedLoading zoomToBoundsOnClick={true} spiderfyOnMaxZoom={false} disableClusteringAtZoom={14} maxClusterRadius={45} iconCreateFunction={(cluster) => L.divIcon({ html: `<div class="custom-cluster-marker" style="width:40px;height:40px;">${cluster.getChildCount()}</div>` })}>
            {points.map((point) => (
                <SmartMarker key={getId(point)} point={point} selectedId={selectedId} navigate={navigate} userLocation={userLocation} activeReservationId={activeReservationId} />
            ))}
        </MarkerClusterGroup>
        {userLocation && (<Marker position={[userLocation.lat, userLocation.lon]} icon={L.divIcon({ className: 'custom-div-icon', html: `<div class="user-pulse-marker"><div class="user-pulse-ring"></div><div class="user-dot"></div></div>`, iconSize: [40, 40] })} />)}
      </MapContainer>
    </div>
  );
}