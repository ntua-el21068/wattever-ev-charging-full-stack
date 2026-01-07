// src/pages/ChargingPage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios"; 
import { Card, CardBody, CardHeader, Button, CircularProgress, Chip, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";

// Εικονίδιο Κεραυνού (Σταθερό Component - Ορισμένο απ' έξω)
const BoltIcon = (props) => (
  <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation" viewBox="0 0 24 24" width="1em" {...props}><path d="M6.09 13.28h3.09v7.2c0 1.68 2.07 2.52 3.25 1.33l9.48-9.63c.56-.57.16-1.54-.64-1.54h-3.09v-7.2c0-1.68-2.07-2.52-3.25-1.33l-9.48 9.63c-.56.57-.16 1.54.64 1.54Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></svg>
);

// Κάρτα Στατιστικών (Σταθερό Component - Ορισμένο απ' έξω)
const StatsCard = ({ label, value, color }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center shadow-lg">
    <p className="text-[10px] text-zinc-500 font-bold mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

export default function ChargingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [chargerData, setChargerData] = useState(null); 
  const [view, setView] = useState("loading"); 
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ kwh: 0, cost: 0, time: 0 }); 
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const [loadingAction, setLoadingAction] = useState(false);

  // 1. FETCH CHARGER DATA ON LOAD
  useEffect(() => {
    const fetchCharger = async () => {
      try {
        const res = await axios.get(`http://localhost:9876/api/point/${id}`);
        setChargerData(res.data);
        
        if (res.data.status === 'CHARGING') {
             setView("active");
        } else {
             setView("payment");
        }
      } catch (err) {
        console.error("Error fetching charger:", err);
        alert("Δεν βρέθηκε ο φορτιστής (βεβαιώσου ότι το Backend τρέχει στο port 9876).");
        navigate('/'); 
      }
    };
    fetchCharger();
  }, [id, navigate]);


  // 2. HANDLE START CHARGING
  const handleStartCharging = async () => {
    setLoadingAction(true);
    try {
        await axios.post(`http://localhost:9876/api/charge/start/${id}/VEH_001`);
        setView("active");
    } catch (err) {
        alert("Σφάλμα εκκίνησης: " + (err.response?.data?.detail || err.message));
    } finally {
        setLoadingAction(false);
    }
  };


  // 3. HANDLE STOP SESSION
  const handleStopSession = async () => {
      setLoadingAction(true);
      try {
          const res = await axios.post(`http://localhost:9876/api/charge/stop/${id}`);
          setStats({
              kwh: res.data.kwh,
              cost: res.data.cost,
              time: res.data.duration_min 
          });
          setView("summary");
      } catch (err) {
          alert("Σφάλμα τερματισμού: " + (err.response?.data?.detail || err.message));
      } finally {
          setLoadingAction(false);
      }
  };

  // --- TIMER SIMULATION ---
  useEffect(() => {
    let interval;
    if (view === "active") {
      interval = setInterval(() => {
        setStats(prev => ({
          kwh: prev.kwh + 0.005, 
          cost: (prev.kwh + 0.005) * (chargerData?.kwhprice || 0.30),
          time: prev.time + 1 
        }));
        // Αυξάνουμε το progress χωρίς να κάνουμε reset το component
        setProgress(prev => (prev >= 100 ? 0 : prev + 1)); 
      }, 1000); 
    }
    return () => clearInterval(interval);
  }, [view, chargerData]);


  // --- RENDER ---
  if (!chargerData && view === "loading") return <div className="text-white text-center mt-20">Φόρτωση...</div>;

  return (
    <div className="min-h-screen w-full bg-black flex justify-center p-4 pt-10">
      <div className="w-full max-w-xl">
        
        {/* === VIEW 1: PAYMENT (PREPARATION) === */}
        {view === "payment" && (
            <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
            <div className="flex items-center gap-3">
                <BoltIcon className="text-5xl text-yellow-400 drop-shadow-[0_0_10px_rgba(255,255,0,0.5)]" />
                <h1 className="text-3xl font-bold tracking-wider">Ready to Charge</h1>
            </div>
            
            <Card className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-700 shadow-2xl">
                <CardHeader className="flex flex-col items-start gap-1 pb-4">
                    <p className="text-lg font-bold text-zinc-300">{chargerData?.station_name || "Άγνωστος Σταθμός"}</p>
                    <p className="text-sm text-zinc-400">{chargerData?.station_address}</p>
                    <Chip size="sm" color="warning" variant="flat" className="mt-2">ID: {id}</Chip>
                </CardHeader>
                <Divider className="bg-zinc-700"/>
                <CardBody className="py-8">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400">Τιμή ανά kWh:</span>
                    <span className="text-xl font-bold text-white">{chargerData?.kwhprice} €</span>
                </div>
                <div className="flex justify-between items-end mb-6">
                    <span className="text-zinc-400">Προ-δέσμευση:</span>
                    <span className="text-3xl font-bold text-blue-500">15.00€</span>
                </div>
                
                <Button 
                    color="primary" 
                    size="lg" 
                    className="w-full font-bold text-lg shadow-lg shadow-blue-500/20"
                    isLoading={loadingAction}
                    onPress={handleStartCharging}
                >
                    ΕΝΑΡΞΗ ΦΟΡΤΙΣΗΣ
                </Button>
                </CardBody>
            </Card>
            </div>
        )}

        {/* === VIEW 2: ACTIVE CHARGING === */}
        {view === "active" && (
            <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
            <Chip variant="flat" classNames={{ base: "bg-green-500/20 border-green-500/50 border", content: "text-green-400 font-bold tracking-wide" }}>
                ● ΦΟΡΤΙΣΗ ΣΕ ΕΞΕΛΙΞΗ
            </Chip>
            
            <div className="relative flex items-center justify-center py-4">
                <div className="absolute inset-0 bg-green-500/10 blur-3xl rounded-full"></div>
                {/* ΕΔΩ ΕΙΝΑΙ Η ΑΛΛΑΓΗ: Επειδή είναι απευθείας στο render, δεν θα κάνει reset */}
                <CircularProgress 
                classNames={{ svg: "w-72 h-72 drop-shadow-2xl", indicator: "stroke-green-500", track: "stroke-zinc-800", value: "text-4xl font-bold text-white" }}
                value={progress} strokeWidth={3} showValueLabel={false}
                />
                <div className="absolute flex flex-col items-center">
                    <span className="text-5xl font-bold text-white">{stats.kwh.toFixed(2)}</span>
                    <span className="text-sm text-zinc-500 font-bold tracking-widest">kWh</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                <StatsCard label="ΙΣΧΥΣ" value={`${chargerData?.cap || 22} kW`} color="text-white" />
                <StatsCard label="ΧΡΟΝΟΣ" value={`${Math.floor(stats.time / 60)}:${(stats.time % 60).toString().padStart(2,'0')}`} color="text-blue-400" />
                <StatsCard label="ΚΟΣΤΟΣ" value={`${stats.cost.toFixed(2)}€`} color="text-green-400" />
            </div>

            <Button color="danger" variant="flat" onPress={onOpen} className="w-full max-w-md font-bold mt-4" isLoading={loadingAction}>
                ΤΕΡΜΑΤΙΣΜΟΣ
            </Button>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" classNames={{base: "bg-zinc-900 border border-zinc-700"}}>
                <ModalContent>
                {(onClose) => (
                    <>
                    <ModalHeader className="text-white">Διακοπή Φόρτισης</ModalHeader>
                    <ModalBody className="text-zinc-400">Είστε σίγουροι ότι θέλετε να σταματήσετε τη διαδικασία;</ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} className="text-white">Άκυρο</Button>
                        <Button color="danger" onPress={() => { onClose(); handleStopSession(); }}>Ναι, Τερματισμός</Button>
                    </ModalFooter>
                    </>
                )}
                </ModalContent>
            </Modal>
            </div>
        )}

        {/* === VIEW 3: SUMMARY === */}
        {view === "summary" && (
            <div className="flex flex-col items-center gap-6 mt-10 w-full animate-appearance-in text-white">
            <h1 className="text-3xl font-bold text-green-500">Ολοκληρώθηκε!</h1>
            <Card className="w-full max-w-md p-6 bg-zinc-900 border border-green-500/30 shadow-2xl">
                <CardBody className="gap-6">
                <div className="flex justify-center my-4">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 text-5xl border border-green-500/20">✓</div>
                </div>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-zinc-300">
                    <span>Σύνολο kWh:</span>
                    <span className="font-bold">{stats.kwh.toFixed(2)} kWh</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                    <span>Τελική Χρέωση:</span>
                    <span className="font-bold text-white text-lg">{stats.cost.toFixed(2)}€</span>
                    </div>
                    <Divider className="bg-zinc-700 my-2"/>
                    <div className="flex justify-between items-center text-green-400 font-bold text-xl">
                    <span>Επιστροφή:</span>
                    <span>{(15.00 - stats.cost).toFixed(2)}€</span>
                    </div>
                </div>
                </CardBody>
            </Card>
            <Button color="primary" variant="ghost" className="font-bold w-full max-w-md" onPress={() => navigate('/')}>
                ΕΠΙΣΤΡΟΦΗ ΣΤΟ ΧΑΡΤΗ
            </Button>
            </div>
        )}

      </div>
    </div>
  );
}