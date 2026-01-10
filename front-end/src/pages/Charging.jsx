import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios"; 
import { Card, CardBody, CardHeader, Button, CircularProgress, Chip, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";

const DEMO_TOTAL_MS = 2 * 60 * 1000; 

// --- HELPER: Distance Calculation ---
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

const BoltIcon = (props) => (<svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation" viewBox="0 0 24 24" width="1em" {...props}><path d="M6.09 13.28h3.09v7.2c0 1.68 2.07 2.52 3.25 1.33l9.48-9.63c.56-.57.16-1.54-.64-1.54h-3.09v-7.2c0-1.68-2.07-2.52-3.25-1.33l-9.48 9.63c-.56.57-.16 1.54.64 1.54Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></svg>);
const PlugIcon = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M8 8v8M16 8v8M2 12h20" strokeLinecap="round"/></svg>;
const CheckIcon = () => <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>;

const StatsCard = ({ label, value, color }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center shadow-lg min-w-[80px]">
    <p className="text-[10px] text-zinc-500 font-bold mb-1 uppercase">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
  </div>
);

export default function ChargingPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  const [view, setView] = useState("loading"); 
  const [chargerData, setChargerData] = useState(null); 
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ kwh: 0, cost: 0, timeSec: 0 }); 
  const [overstaySec, setOverstaySec] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [nearbyPoints, setNearbyPoints] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  
  const {isOpen, onOpen, onOpenChange} = useDisclosure();

  // 1. GET GEOLOCATION
  useEffect(() => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            setUserLocation({ 
                lat: position.coords.latitude, 
                lon: position.coords.longitude 
            });
        });
    }
  }, []);

  // 2. INITIAL FETCH
  useEffect(() => {
    if (!id) {
        const savedId = localStorage.getItem('active_session_point_id');
        if (savedId) navigate(`/charging/${savedId}`, { replace: true });
        else setView("empty");
        return;
    }

    const fetchData = async () => {
      try {
        const res = await axios.get(`http://localhost:9876/api/point/${id}`);
        setChargerData(res.data);
        const status = (res.data.status || '').toUpperCase();

        if (status === 'CHARGING') {
             setView("active");
             localStorage.setItem('active_session_point_id', id);
             if (!localStorage.getItem(`session_start_${id}`)) {
                 if(res.data.current_session_start) {
                     localStorage.setItem(`session_start_${id}`, new Date(res.data.current_session_start).getTime().toString());
                 } else {
                     localStorage.setItem(`session_start_${id}`, Date.now().toString());
                 }
             }
        } else if (status === 'AVAILABLE' || status === 'RESERVED') {
             setView("payment"); 
        } else {
             setView("empty"); 
        }
      } catch (err) { setView("empty"); }
    };
    fetchData();
  }, [id, navigate]);

  // 3. FETCH NEARBY (FILTERED < 500m)
  useEffect(() => {
    const fetchNearby = async () => {
        if (!userLocation) return;

        try {
            const res = await axios.get('http://localhost:9876/api/points');
            
            // 1. Calculate Distances
            const withDistance = res.data.map(p => ({
                ...p,
                distance: getDistanceFromLatLonInM(userLocation.lat, userLocation.lon, parseFloat(p.lat), parseFloat(p.lon))
            }));

            // 2. Filter: Available + Not Current + Within 500m
            const available = withDistance.filter(p => 
                (p.status || '').toUpperCase() === 'AVAILABLE' && 
                String(p.pointid) !== String(id) &&
                p.distance <= 500 // Geofencing Filter
            );
            
            // 3. Sort by closest
            available.sort((a, b) => a.distance - b.distance);

            setNearbyPoints(available); 
        } catch(e) { console.error(e); }
    };
    fetchNearby();
  }, [id, userLocation]);

  // 4. LOGIC LOOP
  useEffect(() => {
    let interval;
    if (view === "active" && id) {
      interval = setInterval(() => {
        const startTimeStr = localStorage.getItem(`session_start_${id}`);
        if (!startTimeStr) return;
        const elapsedMs = Date.now() - parseInt(startTimeStr);
        
        let newProgress = (elapsedMs / DEMO_TOTAL_MS) * 100;
        if (newProgress >= 100) {
            newProgress = 100;
            setView("disconnecting");
        }

        const durationSec = Math.floor(elapsedMs / 1000);
        const simulatedKwh = (22 * (Math.min(elapsedMs, DEMO_TOTAL_MS) / 3600000)); 
        const simulatedCost = simulatedKwh * (chargerData?.kwhprice || 0.30);

        setProgress(newProgress);
        setStats({ timeSec: durationSec, kwh: simulatedKwh, cost: simulatedCost });
      }, 1000); 
    } else if (view === "disconnecting") {
        interval = setInterval(() => { setOverstaySec(prev => prev + 1); }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, id, chargerData]);

  // ACTIONS
  const handleStartCharging = async () => {
    setLoadingAction(true);
    try {
        await axios.post(`http://localhost:9876/api/charge/start/${id}/VEH_001`);
        const now = Date.now();
        localStorage.setItem(`session_start_${id}`, now.toString());
        localStorage.setItem('active_session_point_id', id);
        setStats({ kwh: 0, cost: 0, timeSec: 0 });
        setProgress(0);
        window.location.reload(); 
    } catch (err) { setLoadingAction(false); }
  };

  const handleStopSession = async () => {
      setLoadingAction(true);
      try {
          const res = await axios.post(`http://localhost:9876/api/charge/stop/${id}`);
          setStats({ 
              kwh: res.data.kwh, 
              cost: res.data.cost, 
              timeSec: res.data.duration_min * 60 
          });
      } catch (err) {
          console.error("Stop error or demo mode, using local stats", err);
      } finally {
          localStorage.removeItem(`session_start_${id}`);
          localStorage.removeItem('active_session_point_id');
          setView("summary");
          setLoadingAction(false);
      }
  };

  const handleDisconnect = async () => {
      setLoadingAction(true);
      try {
          const res = await axios.post(`http://localhost:9876/api/charge/stop/${id}`);
          const overstayFee = overstaySec > 30 ? 2.50 : 0.00; 
          setStats({ 
              kwh: res.data.kwh, 
              cost: res.data.cost + overstayFee, 
              timeSec: res.data.duration_min * 60,
              overstayFee: overstayFee
          });
          setView("summary");
      } catch (err) { 
          const overstayFee = overstaySec > 30 ? 2.50 : 0.00;
          setStats(prev => ({...prev, cost: prev.cost + overstayFee, overstayFee: overstayFee}));
          setView("summary"); 
      } finally { 
          localStorage.removeItem(`session_start_${id}`);
          localStorage.removeItem('active_session_point_id');
          setLoadingAction(false); 
      }
  };

  // --- DUMMY PDF ACTION ---
  const handleDownloadPDF = () => {
      alert("Receipt Downloaded! (Simulation)");
  };

  const handleGoToMap = (targetId) => { navigate('/', { state: { targetId: targetId } }); };
  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen w-full bg-black flex justify-center p-4 pt-10 overflow-y-auto">
      <div className="w-full max-w-xl flex flex-col items-center pb-20">
        
        {view === "loading" && <CircularProgress color="primary" />}

        {view === "empty" && (
            <Card className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-5xl mb-6">🔌</div>
                <h2 className="text-2xl font-bold text-white mb-2">Monitor Standby</h2>
                <Button color="primary" onPress={() => navigate('/')}>Find Station</Button>
            </Card>
        )}

        {view === "payment" && chargerData && (
            <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
                <div className="flex items-center gap-3"><BoltIcon className="text-5xl text-yellow-400" /><h1 className="text-3xl font-bold tracking-wider">Ready to Charge</h1></div>
                <Card className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-700 shadow-2xl">
                    <CardHeader className="flex flex-col items-start gap-1 pb-4">
                        <p className="text-lg font-bold text-zinc-300">{chargerData.station_name}</p>
                        <p className="text-sm text-zinc-400">{chargerData.station_address}</p>
                    </CardHeader>
                    <Divider className="bg-zinc-700"/>
                    <CardBody className="py-8">
                        <div className="flex justify-between items-center mb-2"><span className="text-zinc-400">Rate:</span><span className="text-xl font-bold text-white">{chargerData.kwhprice} €/kWh</span></div>
                        <Button color="primary" size="lg" className="w-full font-bold text-lg mt-4" isLoading={loadingAction} onPress={handleStartCharging}>START CHARGING</Button>
                    </CardBody>
                </Card>
            </div>
        )}

        {view === "active" && chargerData && (
            <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
                <Chip variant="flat" classNames={{ base: "bg-green-500/20 border-green-500/50 border", content: "text-green-400 font-bold tracking-wide animate-pulse" }}>● CHARGING</Chip>
                <div className="relative flex items-center justify-center py-4">
                    <div className="absolute inset-0 bg-green-500/10 blur-3xl rounded-full"></div>
                    <CircularProgress classNames={{ svg: "w-72 h-72 drop-shadow-2xl", indicator: "stroke-green-500 transition-all duration-500", track: "stroke-zinc-800" }} value={progress} strokeWidth={3} showValueLabel={false} />
                    <div className="absolute flex flex-col items-center"><span className="text-6xl font-bold text-white">{Math.floor(progress)}%</span><span className="text-sm text-green-400 font-bold tracking-widest mt-1">BATTERY</span></div>
                </div>
                <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                    <StatsCard label="POWER" value={`${chargerData.cap} kW`} color="text-white" />
                    <StatsCard label="ENERGY" value={`${stats.kwh.toFixed(2)}`} color="text-yellow-400" />
                    <StatsCard label="TIME" value={formatTime(stats.timeSec)} color="text-blue-400" />
                    <StatsCard label="COST" value={`${stats.cost.toFixed(2)}€`} color="text-green-400" />
                </div>
                
                <Button color="danger" variant="flat" onPress={onOpen} className="w-full max-w-md font-bold mt-6">STOP SESSION</Button>

                <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" classNames={{base: "bg-zinc-900 border border-zinc-700"}}>
                    <ModalContent>
                    {(onClose) => (
                        <>
                        <ModalHeader className="text-white">Stop Charging</ModalHeader>
                        <ModalBody className="text-zinc-400">Are you sure you want to stop the session? You will be billed for the energy consumed so far.</ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose} className="text-white">Cancel</Button>
                            <Button color="danger" onPress={() => { onClose(); handleStopSession(); }}>Yes, Stop</Button>
                        </ModalFooter>
                        </>
                    )}
                    </ModalContent>
                </Modal>
            </div>
        )}

        {view === "disconnecting" && (
            <div className="flex flex-col items-center gap-6 w-full animate-slide-in-bottom text-white">
                <div className="w-full max-w-md bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-green-500 shadow-[0_0_20px_#22c55e]"></div>
                    <h1 className="text-4xl font-black italic mb-2 text-white">100%</h1>
                    <p className="text-green-400 font-bold tracking-widest uppercase mb-8">Fully Charged</p>
                    <div className="bg-black/50 p-6 rounded-full mb-6 border border-zinc-700 animate-pulse"><PlugIcon /></div>
                    <h2 className="text-xl font-bold mb-2">Please Disconnect Cable</h2>
                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg w-full mb-6"><p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Overstay Timer</p><p className="text-2xl font-mono text-red-500 font-bold">{formatTime(overstaySec)}</p></div>
                    <Button color="success" size="lg" className="w-full font-bold shadow-lg" isLoading={loadingAction} onPress={handleDisconnect}>I HAVE DISCONNECTED</Button>
                </div>
            </div>
        )}

        {view === "summary" && (
            <div className="flex flex-col items-center gap-6 w-full animate-appearance-in text-white">
                <div className="flex items-center gap-2 mb-4"><div className="bg-green-500 rounded-full p-1"><CheckIcon /></div><h1 className="text-3xl font-bold">Session Complete</h1></div>
                
                <div className="w-full max-w-sm bg-white text-black p-0 rounded-none shadow-2xl relative overflow-hidden">
                    <div className="w-full h-4 bg-zinc-900 absolute -top-2 left-0" style={{clipPath: "polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)"}}></div>
                    <div className="p-8 pt-10 flex flex-col gap-4">
                        <div className="text-center border-b-2 border-dashed border-zinc-300 pb-4 mb-2">
                            <h2 className="font-black text-2xl tracking-tighter">WATT<span className="text-zinc-600">ever</span></h2>
                            <p className="text-xs text-zinc-500 uppercase">Receipt</p>
                            <p className="text-xs text-zinc-400">{new Date().toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between text-sm"><span>Energy</span><span className="font-bold">{stats.kwh.toFixed(2)} kWh</span></div>
                        <div className="flex justify-between text-sm"><span>Duration</span><span className="font-bold">{formatTime(stats.timeSec)}</span></div>
                        {stats.overstayFee > 0 && <div className="flex justify-between text-sm text-red-600"><span>Overstay</span><span className="font-bold">+{stats.overstayFee}€</span></div>}
                        <div className="border-t-2 border-black pt-4 mt-2 flex justify-between items-end"><span className="font-bold text-lg">TOTAL</span><span className="font-black text-3xl">{stats.cost.toFixed(2)}€</span></div>
                    </div>
                    <div className="w-full h-4 bg-zinc-900 absolute -bottom-2 left-0" style={{clipPath: "polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)"}}></div>
                </div>

                <div className="flex gap-3 w-full max-w-sm mt-4">
                    <Button variant="ghost" className="flex-1 text-white border-zinc-700" onPress={handleDownloadPDF}>Download PDF</Button>
                    <Button color="primary" className="flex-1 font-bold" onPress={() => navigate('/')}>Map</Button>
                </div>
            </div>
        )}

        {/* --- NEARBY CHARGERS SECTION (< 500m ONLY) - SCROLLABLE --- */}
        <div className="w-full max-w-md mt-12 mb-10 border-t border-zinc-800 pt-6">
            <h3 className="text-lg font-bold text-zinc-400 mb-4 uppercase tracking-widest">Available Chargers Nearby (&lt;500m)</h3>
            
            {/* SCROLLABLE CONTAINER */}
            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-2" style={{scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #18181b'}}>
                {nearbyPoints.length > 0 ? nearbyPoints.map(point => (
                    <Card key={point.pointid} isPressable onPress={() => handleGoToMap(point.pointid)} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all flex-shrink-0">
                        <CardBody className="flex flex-row justify-between items-center p-4">
                            <div className="flex flex-col items-start text-left">
                                <span className="text-white font-bold">{point.station_address || `Station #${point.pointid}`}</span>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{point.cap} kW</span>
                                    {/* Distance Badge */}
                                    <span className="text-xs text-green-400 bg-green-900/30 border border-green-500/30 px-2 py-0.5 rounded font-mono">
                                        {Math.round(point.distance)}m
                                    </span>
                                </div>
                            </div>
                            <Button size="sm" className="bg-green-600 text-black font-bold shadow-lg animate-pulse">CHARGE</Button>
                        </CardBody>
                    </Card>
                )) : (<p className="text-zinc-600 italic">No chargers found within 500m.</p>)}
            </div>
        </div>

      </div>
    </div>
  );
}