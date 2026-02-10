import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from "@heroui/react";
import axios from 'axios';
import MapPage from './pages/MapPage';
import Charging from './pages/Charging'; 
import Reservation from './pages/Reservation'; 
import API_BASE_URL from './config'; 

// --- ICONS ΓΙΑ ΤΟ MOBILE MENU ---
const GlobeIcon = ({ active }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={active ? "#4ade80" : "#d4d4d8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

const CalendarIcon = ({ active }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={active ? "#4ade80" : "#d4d4d8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
    <path d="M12 14h.01"></path> 
  </svg>
);

const BoltIcon = ({ active, animate }) => (
  <svg className={animate ? "animate-pulse" : ""} width="28" height="28" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke={active ? "#4ade80" : "#d4d4d8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={active ? "#4ade80" : "none"} stroke={active ? "#4ade80" : "#d4d4d8"}></polygon>
  </svg>
);

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
            // Χρήση του API_BASE_URL από το config
            const res = await axios.get(`${API_BASE_URL}/api/user/active_reservation`);
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
    const interval = setInterval(checkStatus, 3000); 
    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
      if (!timeLeft || timeLeft <= 0) return;
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
  }, [timeLeft]);

  const formatMinSec = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black text-white font-sans selection:bg-green-500 selection:text-black">
      
      {/* --- FIERCE NAVBAR --- */}
      <Navbar 
        isBordered 
        maxWidth="full" 
        className="h-16 sm:h-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 z-[9000]"
        classNames={{
            item: [
              "flex", "relative", "h-full", "items-center",
              "sm:data-[active=true]:after:content-['']",
              "sm:data-[active=true]:after:absolute",
              "sm:data-[active=true]:after:bottom-0",
              "sm:data-[active=true]:after:left-0",
              "sm:data-[active=true]:after:right-0",
              "sm:data-[active=true]:after:h-[2px]",
              "sm:data-[active=true]:after:bg-green-500",
            ],
        }}
      >
        <NavbarBrand className="gap-2 sm:gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-gradient-to-br from-green-400 to-green-600 text-black font-bold p-1.5 sm:p-2 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.5)]">
            ⚡
          </div>
          <p className="font-black text-lg sm:text-2xl tracking-tighter italic text-white">
            WATT<span className="text-green-500">ever</span>
          </p>
        </NavbarBrand>
        
        {/* --- DESKTOP MENU --- */}
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
          <NavbarItem isActive={location.pathname.includes("/charging")}>
            <Link 
                to={activeSessionId ? `/charging/${activeSessionId}` : "/charging"} 
                className={`text-lg font-bold tracking-wide transition-colors ${activeSessionId ? 'text-green-400 animate-pulse' : 'text-zinc-300 hover:text-white'}`}
            >
              CHARGING
            </Link>
          </NavbarItem>
        </NavbarContent>

        {/* --- MOBILE MENU (ICONS) --- */}
        <NavbarContent className="flex sm:hidden gap-6" justify="center">
            <NavbarItem>
                <Link to="/" className="flex flex-col items-center justify-center h-full w-10">
                    <GlobeIcon active={location.pathname === "/"} />
                </Link>
            </NavbarItem>
            <NavbarItem>
                <Link to="/reserve" className="flex flex-col items-center justify-center h-full w-10">
                    <CalendarIcon active={location.pathname.includes("/reserve")} />
                </Link>
            </NavbarItem>
            <NavbarItem>
                <Link to={activeSessionId ? `/charging/${activeSessionId}` : "/charging"} className="flex flex-col items-center justify-center h-full w-10">
                   <div className={activeSessionId ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" : ""}>
                        <BoltIcon active={location.pathname.includes("/charging")} animate={!!activeSessionId} />
                   </div>
                </Link>
            </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end">
            {activeSessionId && (
                <NavbarItem>
                    <Button 
                        isIconOnly
                        size="sm"
                        onPress={() => navigate(`/charging/${activeSessionId}`)}
                        className="bg-green-500/20 border border-green-500/50 text-green-400 animate-pulse"
                        variant="flat"
                    >
                       ⚡
                    </Button>
                </NavbarItem>
            )}

            {reservationData && !activeSessionId && (
                 <NavbarItem>
                    <Button 
                        size="sm"
                        onPress={() => navigate(`/reserve/${reservationData.pointid}`)}
                        className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 font-bold px-2 min-w-0"
                        variant="flat"
                    >
                        {timeLeft ? formatMinSec(timeLeft) : '⏱'}
                    </Button>
                </NavbarItem>
            )}
            
            <NavbarItem>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer">
                    👤
                </div>
            </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex-1 relative overflow-hidden bg-black w-full"> 
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/reserve/:id" element={<Reservation />} />
          <Route path="/reserve" element={<Reservation />} />
          <Route path="/charging/:id" element={<Charging />} />
          <Route path="/charging" element={<Charging />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;