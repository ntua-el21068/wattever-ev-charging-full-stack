// src/pages/Reservation.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardBody, CardHeader, Button, Divider, Chip } from "@heroui/react";

export default function ReservationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- STATE ---
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reservationData, setReservationData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (!timeLeft || timeLeft <= 0) return;
    const timerId = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // --- HANDLE RESERVE ---
  const handleReserve = async () => {
    setError(null);
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const res = await axios.post(`http://localhost:9876/api/reserve/${id}/${minutes}`);
      const data = res.data;
      const end = new Date(data.reservationendtime).getTime();
      const now = new Date().getTime();
      
      setReservationData(data);
      setTimeLeft(Math.floor((end - now) / 1000));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Reservation failed");
    } finally {
      setLoading(false);
    }
  };

  // --- 1. SUCCESS SCREEN ---
  if (reservationData) {
    return (
      <div className="min-h-screen w-full bg-black flex justify-center p-4 pt-6 text-white animate-appearance-in">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-4xl mb-2">
            ✅
          </div>
          <h2 className="text-3xl font-bold text-green-500">Επιτυχία!</h2>
          <p className="text-zinc-400">Ο φορτιστής {reservationData.pointid} κρατήθηκε.</p>
          <Card className="w-full bg-zinc-900 border border-green-500/50 p-4">
             <p className="text-5xl font-mono font-bold text-white tracking-widest">
               {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
             </p>
             <p className="text-xs text-green-400 mt-2 uppercase tracking-wide">Χρονος που απομενει</p>
          </Card>
          <p className="text-sm text-zinc-500 px-4">
            Οδηγήστε στον σταθμό και συνδέστε το όχημά σας πριν λήξει ο χρόνος.
          </p>
          <Button variant="ghost" color="primary" className="w-full font-bold border-1" onPress={() => navigate('/')}>
            Επιστροφή στον Χάρτη
          </Button>
        </div>
      </div>
    );
  }

  // --- 2. RESERVATION FORM ---
  return (
    // ΑΛΛΑΓΗ 1: Προσθέσαμε pb-20 (padding bottom) και overflow-y-auto για να γίνεται scroll αν χρειαστεί
    <div className="min-h-screen w-full bg-black flex justify-center p-4 pt-4 pb-20 text-white overflow-y-auto">
      
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" onPress={() => navigate('/')} className="text-white">←</Button>
          <span className="text-xl font-bold">Κράτηση Θέσης</span>
        </div>

        {/* CHARGER INFO */}
        <Card className="bg-zinc-900 border border-zinc-700">
          <CardBody className="flex flex-row justify-between items-center p-4">
            <div>
              <h3 className="text-lg font-bold text-white">Φορτιστής #{id}</h3>
              <p className="text-sm text-zinc-400">Type 2 • 22kW • AC</p>
            </div>
            <Chip color="success" variant="flat" size="sm">Available</Chip>
          </CardBody>
        </Card>

        {/* TIME SELECTION */}
        <div>
          <h4 className="text-sm text-zinc-500 uppercase tracking-wider mb-3 pl-1">Χρονος Αφιξης</h4>
          <div className="grid grid-cols-4 gap-3">
            {[15, 30, 45, 60].map((m) => (
              <Button
                key={m}
                onPress={() => setMinutes(m)}
                color={minutes === m ? "primary" : "default"}
                variant={minutes === m ? "solid" : "flat"}
                className={`font-bold ${minutes !== m ? 'bg-zinc-800 text-white' : ''}`}
              >
                {m}'
              </Button>
            ))}
          </div>
        </div>

        {/* PAYMENT SUMMARY */}
        <div>
          <h4 className="text-sm text-zinc-500 uppercase tracking-wider mb-3 pl-1">Πληρωμη</h4>
          <Card className="bg-zinc-900 border border-zinc-700">
            <CardBody className="flex flex-row justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-xl">💳</div>
                <div>
                  <div className="font-bold text-sm text-white">MasterCard •• 4242</div>
                  <div className="text-xs text-green-400">Wallet Connected</div>
                </div>
              </div>
              <div className="font-bold text-lg text-white">0.50 €</div>
            </CardBody>
          </Card>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* FOOTER ACTION */}
        {/* ΑΛΛΑΓΗ 2: Βγάλαμε το mt-auto και βάλαμε mt-8 mb-4 για να μην κολλάει κάτω */}
        <div className="mt-8 mb-4">
          <Button 
            color="primary" 
            size="lg" 
            className="w-full font-bold shadow-lg shadow-blue-500/20"
            isLoading={loading}
            onPress={handleReserve}
          >
            {loading ? 'Επεξεργασία...' : 'Πληρωμή 0.50€ & Κράτηση'}
          </Button>
        </div>

      </div>
    </div>
  );
}