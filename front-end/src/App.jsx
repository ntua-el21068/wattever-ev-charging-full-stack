// src/App.jsx
import { Routes, Route, Link } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link as UiLink, Button } from "@heroui/react";
import MapPage from './pages/MapPage';
import ReservationPage from './pages/ReservationPage';
import ChargingPage from './pages/ChargingPage';

function App() {
  return (
    <>
      {/* Κοινό Navbar για όλους */}
      <Navbar>
        <NavbarBrand>
          <p className="font-bold text-inherit">WATTever</p>
        </NavbarBrand>
        <NavbarContent justify="center">
          <NavbarItem>
            <Link to="/" className="text-white">Χάρτης</Link>
          </NavbarItem>
          <NavbarItem>
            <Link to="/charging" className="text-white">Φόρτιση</Link>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Εδώ ο καθένας βλέπει τη δουλειά του */}
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/reserve/:id" element={<ReservationPage />} />
        <Route path="/charging" element={<ChargingPage />} />
      </Routes>
    </>
  );
}

export default App;

import MapPage from './MapPage';

function App() {
  return (
    <MapPage />
  );
}

export default App;