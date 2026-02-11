import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card, CardBody, Button, Chip, CircularProgress } from "@heroui/react";
import API_BASE_URL from '../config';

const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

export default function ReservationPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation(); 

  const [viewMode, setViewMode] = useState("loading");
  const [reservationData, setReservationData] = useState(null);
  const [targetPoint, setTargetPoint] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [minutes, setMinutes] = useState(30);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState(null);
  const [nearbyPoints, setNearbyPoints] = useState([]);
  const [userLocation, setUserLocation] = useState(null); 

  const calculatedPrice = (0.50 + (minutes > 15 ? (minutes - 15) * 0.02 : 0)).toFixed(2);

  useEffect(() => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        });
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/user/active_reservation`);
        if (res.data && res.data.reservation_id) {
            setReservationData(res.data);
            const endTime = new Date(res.data.expiration_time).getTime();
            const now = new Date().getTime();
            setTimeLeft(Math.floor((endTime - now) / 1000));
            setViewMode("active"); 
            return; 
        }
        if (id) {
            const pointRes = await axios.get(`${API_BASE_URL}/api/point/${id}`);
            if (pointRes.data.status === 'AVAILABLE') {
                setTargetPoint(pointRes.data);
                setViewMode("booking");
            } else {
                setError("Station not available.");
                setViewMode("standby");
            }
        } else {
            setViewMode("standby");
        }
    } catch (err) { setViewMode("standby"); }
  }, [id]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const fetchNearby = async () => {
        if (!userLocation) return; 
        try {
            const res = await axios.get(`${API_BASE_URL}/api/points`);
            const currentId = reservationData?.pointid || targetPoint?.pointid || id;
            let available = res.data.filter(p => (p.status || '').toUpperCase() === 'AVAILABLE' && String(p.pointid) !== String(currentId));
            available = available.map(p => ({
                ...p,
                distance: getDistanceFromLatLonInM(userLocation.lat, userLocation.lon, parseFloat(p.lat), parseFloat(p.lon))
            }));
            available.sort((a, b) => a.distance - b.distance);
            setNearbyPoints(available.slice(0, 10)); 
        } catch(e) { console.error(e); }
    };
    fetchNearby();
  }, [id, reservationData, targetPoint, userLocation]);

  useEffect(() => {
    if (viewMode !== 'active' || timeLeft === null) return;
    const interval = setInterval(() => { setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1)); }, 1000);
    return () => clearInterval(interval);
  }, [viewMode, timeLeft]);

  const handleReserve = async () => {
    if (!targetPoint) return;
    setLoadingAction(true);
    try {
        await axios.post(`${API_BASE_URL}/api/reserve/${targetPoint.pointid}/${minutes}`);
        navigate('/reserve');
        window.location.reload(); 
    } catch (err) { setLoadingAction(false); setError("Booking failed"); }
  };

  const handleGoToMap = (targetId) => { navigate('/', { state: { targetId: targetId } }); };
  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full w-full bg-black flex justify-center text-white overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-md flex flex-col gap-6 p-4 pt-6 pb-24">
        
        <div className="flex items-center justify-between shrink-0">
            <span className="text-2xl font-bold tracking-tight">Reservations</span>
            {viewMode === 'active' && <Chip size="sm" color="warning" variant="dot">Active</Chip>}
        </div>

        {viewMode === 'loading' && <div className="flex justify-center py-20"><CircularProgress aria-label="Loading..." size="lg" color="primary" /></div>}

        {viewMode === 'booking' && targetPoint && (
            <div className="animate-appearance-in flex flex-col gap-4 shrink-0">
                <Card className="bg-zinc-900 border border-zinc-700 p-5">
                    <div className="flex justify-between"><div><h3 className="text-xl font-bold mb-1">Station #{targetPoint.pointid}</h3><p className="text-zinc-400 text-sm">{targetPoint.station_address}</p></div><div className="flex flex-col items-center bg-zinc-800 p-2 rounded border border-zinc-600"><span className="text-2xl font-black">{targetPoint.cap}</span><span className="text-[10px] text-zinc-400">kW</span></div></div>
                </Card>
                <div><h4 className="text-zinc-500 text-sm mb-3 font-bold uppercase">Arrival Time</h4><div className="grid grid-cols-4 gap-3">{[15, 30, 45, 60].map((m) => (<Button key={m} onPress={() => setMinutes(m)} color={minutes === m ? "primary" : "default"} variant={minutes === m ? "solid" : "flat"} className={`font-bold ${minutes !== m ? 'bg-zinc-800 text-white' : ''}`}>{m}'</Button>))}</div></div>
                <Card className="bg-zinc-900 border border-zinc-700 p-4"><div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">💳</span> <span className="font-bold">Reservation Fee</span></div><div className="font-bold text-lg text-green-400">{calculatedPrice} €</div></div></Card>
                <Button color="primary" size="lg" className="w-full font-bold shadow-lg" isLoading={loadingAction} onPress={handleReserve}>PAY & RESERVE ({calculatedPrice}€)</Button>
            </div>
        )}

        {viewMode === 'active' && reservationData && (
            <Card className="w-full bg-zinc-900 border border-green-500/50 p-6 shadow-[0_0_40px_rgba(34,197,94,0.1)] shrink-0">
                <div className="flex justify-between mb-6"><div><h3 className="text-xl font-bold">Station #{reservationData.pointid}</h3><p className="text-zinc-400 text-sm">{reservationData.station_address}</p></div></div>
                <div className="bg-black/60 rounded-2xl p-6 text-center border border-zinc-800 mb-6"><p className="text-6xl font-mono font-bold text-white tracking-widest">{formatTime(timeLeft)}</p><p className="text-xs text-green-500 mt-2 uppercase tracking-widest font-bold">Time to Arrive</p></div>
                <div className="flex gap-3"><Button variant="bordered" className="flex-1 font-bold text-white border-zinc-600" onPress={() => navigate('/')}>Map</Button><Button color="success" className="flex-1 font-bold text-white shadow-lg animate-pulse" onPress={() => navigate(`/charging/${reservationData.pointid}`)}>START CHARGING</Button></div>
            </Card>
        )}

        {viewMode === 'standby' && (
            <Card className="w-full bg-zinc-900/50 border border-zinc-800 border-dashed p-10 flex flex-col items-center text-center shrink-0">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-4xl mb-4 grayscale opacity-50">📅</div>
                <h3 className="text-xl font-bold text-white mb-2">No Active Reservations</h3>
                <p className="text-zinc-500 text-sm mb-8">{error ? error : "Select a station from the map to book a spot."}</p>
                <Button color="primary" variant="flat" onPress={() => navigate('/')}>Find Station</Button>
            </Card>
        )}

        <div className="w-full border-t border-zinc-800 pt-6">
            <h3 className="text-lg font-bold text-zinc-400 mb-4 uppercase tracking-widest px-1">Closest Chargers</h3>
            <div className="flex flex-row sm:flex-col gap-3 overflow-x-auto sm:overflow-visible pb-4 sm:pb-0 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}> 
                {nearbyPoints.length > 0 ? nearbyPoints.map(point => (
                    <Card 
                        key={point.pointid} 
                        isPressable 
                        onPress={() => handleGoToMap(point.pointid)} 
                        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all min-w-[85%] sm:min-w-0 snap-center shrink-0" 
                    >
                        <CardBody className="flex flex-row justify-between items-center p-4">
                            <div className="flex flex-col items-start text-left">
                                <span className="text-white font-bold truncate max-w-[180px] sm:max-w-full">{point.station_address || `Station #${point.pointid}`}</span>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{point.cap} kW</span>
                                    <span className="text-xs text-blue-400 bg-blue-900/30 border border-blue-500/30 px-2 py-0.5 rounded font-mono">{Math.round(point.distance)}m</span>
                                </div>
                            </div>
                            <Button size="sm" onPress={() => handleGoToMap(point.pointid)} className="bg-zinc-800 text-white font-bold border border-zinc-700 ml-2">Book</Button>
                        </CardBody>
                    </Card>
                )) : (<p className="text-zinc-600 italic px-4">Getting location...</p>)}
                <div className="w-4 shrink-0 sm:hidden"></div>
            </div>
        </div>
      </div>
    </div>
  );
}