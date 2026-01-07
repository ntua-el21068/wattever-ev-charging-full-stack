// src/App.jsx
import { Routes, Route, Link } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import MapPage from './pages/MapPage';
import ChargingPage from './pages/Charging';
import ReservationPage from './pages/Reservation'; 

function App() {
  return (
    <div className="flex flex-col h-screen w-screen bg-white">
      
      {/* Navbar - Σκούρο Μπλε */}
      <Navbar 
        maxWidth="full" 
        className="h-16 flex-none text-white z-50 shadow-md"
        style={{ backgroundColor: '#2c3e50' }} 
      >
        <NavbarBrand>
          <p className="font-bold text-xl tracking-wider text-white">🔌 WATTever</p>
        </NavbarBrand>
        
        <NavbarContent justify="center" className="gap-8">
          <NavbarItem>
            <Link to="/" className="text-white hover:text-green-400 font-semibold text-lg">
              Χάρτης
            </Link>
          </NavbarItem>
          
          <NavbarItem>
             {/* Δοκιμαστικό Link για φόρτιση */}
            <Link to="/charging/123" className="text-white hover:text-green-400 font-semibold text-lg">
              Φόρτιση
            </Link>
          </NavbarItem>
          
          <NavbarItem>
             {/* ΕΝΕΡΓΟΠΟΙΗΣΑΜΕ ΤΗΝ ΚΡΑΤΗΣΗ */}
            <Link to="/reserve/1024" className="text-white hover:text-green-400 font-semibold text-lg">
              Κράτηση
            </Link>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Routes */}
      <div className="flex-1 relative overflow-hidden bg-black"> 
        {/* Έβαλα bg-black εδώ για να μην φαίνεται άσπρο κενό όταν αλλάζει σελίδα */}
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/charging/:id" element={<ChargingPage />} />
          {/* Η νέα διαδρομή για την Κράτηση */}
          <Route path="/reserve/:id" element={<ReservationPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;