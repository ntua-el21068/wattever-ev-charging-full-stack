import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from "@heroui/react";
import axios from 'axios';
import MapPage from './pages/MapPage';
import ChargingPage from './pages/Charging';
import ReservationPage from './pages/Reservation'; 

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [reservationData, setReservationData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // --- GLOBAL STATE CHECKER ---
  useEffect(() => {
    const checkStatus = async () => {
        // 1. Check LocalStorage for Charging
        const storedChargeId = localStorage.getItem('active_session_point_id');
        setActiveSessionId(storedChargeId);

        // 2. Check Database for Reservation
        try {
            const res = await axios.get('http://localhost:9876/api/user/active_reservation');
            if (res.data && res.data.reservation_id) {
                setReservationData(res.data);
                // Calculate Time Left
                const end = new Date(res.data.expiration_time).getTime();
                const now = Date.now();
                const diff = Math.floor((end - now) / 1000);
                setTimeLeft(diff > 0 ? diff : 0);
            } else {
                setReservationData(null);
                setTimeLeft(null);
            }
        } catch (e) { console.error(e); }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [location]);

  // Reservation Countdown Timer
  useEffect(() => {
      if (!timeLeft || timeLeft <= 0) return;
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
  }, [timeLeft]);

  const formatMinSec = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white font-sans selection:bg-green-500 selection:text-black">
      
      {/* --- FIERCE NAVBAR --- */}
      <Navbar 
        isBordered 
        maxWidth="full" 
        className="h-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-[9000]"
        classNames={{
            item: [
              "flex", "relative", "h-full", "items-center",
              "data-[active=true]:after:content-['']",
              "data-[active=true]:after:absolute",
              "data-[active=true]:after:bottom-0",
              "data-[active=true]:after:left-0",
              "data-[active=true]:after:right-0",
              "data-[active=true]:after:h-[2px]",
              "data-[active=true]:after:bg-green-500",
            ],
        }}
      >
        <NavbarBrand className="gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-gradient-to-br from-green-400 to-green-600 text-black font-bold p-2 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.5)]">
            ⚡
          </div>
          <p className="font-black text-2xl tracking-tighter italic text-white">
            WATT<span className="text-green-500">ever</span>
          </p>
        </NavbarBrand>
        
        <NavbarContent className="hidden sm:flex gap-8" justify="center">
          <NavbarItem isActive={location.pathname === "/"}>
            <Link to="/" className="text-lg font-bold tracking-wide text-zinc-300 hover:text-white transition-colors">
              MAP
            </Link>
          </NavbarItem>
          <NavbarItem isActive={location.pathname.includes("/reserve")}>
            <Link to="/reserve" className="text-lg font-bold tracking-wide text-zinc-300 hover:text-white transition-colors">
              RESERVE
            </Link>
          </NavbarItem>
          {/* ΜΟΝΙΜΟ CHARGING LINK */}
          <NavbarItem isActive={location.pathname.includes("/charging")}>
            <Link 
                to={activeSessionId ? `/charging/${activeSessionId}` : "/charging"} 
                className={`text-lg font-bold tracking-wide transition-colors ${activeSessionId ? 'text-green-400 animate-pulse' : 'text-zinc-300 hover:text-white'}`}
            >
              CHARGING
            </Link>
          </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end">
            
            {/* WIDGET 1: ACTIVE CHARGING (GREEN) */}
            {activeSessionId && (
                <NavbarItem>
                    <Button 
                        onPress={() => navigate(`/charging/${activeSessionId}`)}
                        className="bg-green-500/20 border border-green-500/50 text-green-400 font-bold animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                        variant="flat"
                        startContent={<div className="w-2 h-2 bg-green-500 rounded-full animate-ping"/>}
                    >
                        MONITORING
                    </Button>
                </NavbarItem>
            )}

            {/* WIDGET 2: ACTIVE RESERVATION (YELLOW) - ME TIMER */}
            {reservationData && !activeSessionId && (
                <NavbarItem>
                    <Button 
                        onPress={() => navigate(`/reserve/${reservationData.pointid}`)}
                        className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 font-bold shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                        variant="flat"
                        startContent={<div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"/>}
                    >
                        {timeLeft ? `${formatMinSec(timeLeft)} LEFT` : 'RESERVED'}
                    </Button>
                </NavbarItem>
            )}
            
            <NavbarItem>
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer">
                    👤
                </div>
            </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex-1 relative overflow-hidden bg-black"> 
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/reserve/:id" element={<ReservationPage />} />
          <Route path="/reserve" element={<ReservationPage />} />
          <Route path="/charging/:id" element={<ChargingPage />} />
          <Route path="/charging" element={<ChargingPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;