// src/pages/ChargingPage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, CircularProgress, Chip, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";

// Εικονίδιο Κεραυνού (SVG)
const BoltIcon = (props) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M6.09 13.28h3.09v7.2c0 1.68 2.07 2.52 3.25 1.33l9.48-9.63c.56-.57.16-1.54-.64-1.54h-3.09v-7.2c0-1.68-2.07-2.52-3.25-1.33l-9.48 9.63c-.56.57-.16 1.54.64 1.54Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
  </svg>
);

// Σταθερές
const MOCK_CHARGER = { id: "1", pricePerKwh: 0.25, provider: "WATTever" };

// --- 1. PAYMENT VIEW (Το βγάλαμε έξω για να μην αναβοσβήνει) ---
const PaymentView = ({ chargerId, onStart }) => (
  <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
    <BoltIcon className="text-5xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
    <h1 className="text-3xl font-bold tracking-wider">Ready to Charge</h1>
    <Card className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-700 shadow-2xl">
      <CardHeader className="flex flex-col items-start gap-1 pb-4">
           <p className="text-lg font-bold text-zinc-300">Φορτιστής #{chargerId}</p>
           <p className="text-small text-zinc-500">Τιμή: {MOCK_CHARGER.pricePerKwh}€ / kWh</p>
      </CardHeader>
      <Divider className="bg-zinc-700"/>
      <CardBody className="py-8">
        <div className="flex justify-between items-end mb-2">
           <span className="text-zinc-400">Ποσό Προ-δέσμευσης</span>
           <span className="text-3xl font-bold text-blue-500">15.00€</span>
        </div>
        <p className="text-xs text-zinc-500 mb-8">
          Το ποσό δεσμεύεται προσωρινά. Η διαφορά επιστρέφεται άμεσα.
        </p>
        <Button 
          color="primary" 
          size="lg" 
          className="w-full font-bold text-lg shadow-lg shadow-blue-500/20"
          onPress={onStart}
        >
          ΠΛΗΡΩΜΗ & ΕΝΑΡΞΗ
        </Button>
      </CardBody>
    </Card>
  </div>
);

// --- 2. ACTIVE VIEW (Τώρα δεν θα αναβοσβήνει!) ---
const ActiveView = ({ progress, stats, onStopConfirm }) => {
  const {isOpen, onOpen, onOpenChange} = useDisclosure();

  return (
    <div className="flex flex-col items-center gap-8 w-full animate-appearance-in text-white">
      {/* Status Badge */}
      <Chip 
        variant="flat" 
        classNames={{
            base: "bg-green-500/20 border-green-500/50 border",
            content: "text-green-400 font-bold tracking-wide"
        }}
      >
        ● ΦΟΡΤΙΣΗ ΣΕ ΕΞΕΛΙΞΗ
      </Chip>
      
      {/* Ο Μεγάλος Κύκλος */}
      <div className="relative flex items-center justify-center py-4">
        {/* Glow effect από πίσω */}
        <div className="absolute inset-0 bg-green-500/10 blur-3xl rounded-full"></div>
        
        <CircularProgress 
          classNames={{
            svg: "w-72 h-72 drop-shadow-2xl",
            indicator: "stroke-green-500",
            track: "stroke-zinc-800",
            value: "text-4xl font-bold text-white",
          }}
          value={progress}
          strokeWidth={3}
          showValueLabel={true}
        />
        <div className="absolute top-[65%] text-sm text-zinc-500 font-bold tracking-widest">BATTERY</div>
      </div>

      {/* Grid με Στατιστικά */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        <StatsCard label="ΙΣΧΥΣ" value="22 kW" color="text-white" />
        <StatsCard label="ΕΝΕΡΓΕΙΑ" value={`${stats.kwh.toFixed(1)} kWh`} color="text-blue-400" />
        <StatsCard label="ΚΟΣΤΟΣ" value={`${stats.cost.toFixed(2)}€`} color="text-green-400" />
      </div>

      {/* Warning */}
      <div className="w-full max-w-md bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-3 items-center">
        <span className="text-xl">⚠️</span>
        <p className="text-xs text-yellow-500/90 leading-tight">
          Overstay fees apply if you stay connected after full charge.
        </p>
      </div>

      {/* Stop Button */}
      <Button 
        color="danger" 
        variant="flat" 
        onPress={onOpen} 
        className="w-full max-w-md font-bold mt-2"
      >
        ΤΕΡΜΑΤΙΣΜΟΣ
      </Button>

      {/* Modal - Τώρα είναι μέσα στο Component αλλά δεν προκαλεί rerender του γονιού */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" classNames={{base: "bg-zinc-900 border border-zinc-700"}}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-white">Διακοπή Φόρτισης</ModalHeader>
              <ModalBody className="text-zinc-400">
                Είστε σίγουροι ότι θέλετε να σταματήσετε τη διαδικασία;
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} className="text-white">Άκυρο</Button>
                <Button color="danger" onPress={() => { onStopConfirm(); onClose(); }}>Ναι, Τερματισμός</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

// Βοηθητικό component για τις κάρτες στατιστικών (για να μην γράφουμε τα ίδια)
const StatsCard = ({ label, value, color }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center shadow-lg">
    <p className="text-[10px] text-zinc-500 font-bold mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

// --- 3. SUMMARY VIEW ---
const SummaryView = ({ stats }) => (
  <div className="flex flex-col items-center gap-6 mt-10 w-full animate-appearance-in text-white">
    <h1 className="text-3xl font-bold text-green-500">Ολοκληρώθηκε!</h1>
    <Card className="w-full max-w-md p-6 bg-zinc-900 border border-green-500/30 shadow-2xl shadow-green-900/20">
      <CardBody className="gap-6">
        <div className="flex justify-center my-4">
          <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 text-5xl border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
            ✓
          </div>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Προ-δέσμευση:</span>
            <span>15.00€</span>
          </div>
          <div className="flex justify-between text-zinc-300">
             <span>Χρέωση Ενέργειας:</span>
             <span>{stats.cost.toFixed(2)}€</span>
          </div>
          <Divider className="bg-zinc-700 my-2"/>
          <div className="flex justify-between items-center text-green-400 font-bold text-xl">
             <span>Επιστροφή (Refund):</span>
             <span>{(15.00 - stats.cost).toFixed(2)}€</span>
          </div>
        </div>
      </CardBody>
    </Card>
    
    <Button color="primary" variant="ghost" className="font-bold w-full max-w-md" as="a" href="/">
      ΕΠΙΣΤΡΟΦΗ ΣΤΟ ΧΑΡΤΗ
    </Button>
  </div>
);


// --- MAIN COMPONENT ---
export default function ChargingPage() {
  const { id } = useParams();
  
  // States
  const [view, setView] = useState("payment"); 
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ kwh: 0, cost: 0, time: "00:00" });

  // Logic
  const handleStartCharging = () => setView("active");
  const handleStopSession = () => setView("summary");

  useEffect(() => {
    let interval;
    if (view === "active") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) { handleStopSession(); return 100; }
          return prev + 1;
        });
        setStats(prev => ({
          kwh: prev.kwh + 0.1,
          cost: (prev.kwh + 0.1) * MOCK_CHARGER.pricePerKwh,
          time: "00:05" 
        }));
      }, 1000); 
    }
    return () => clearInterval(interval);
  }, [view]);

  return (
    // Χρησιμοποιούμε μαύρο φόντο (bg-black) για όλη τη σελίδα
    <div className="min-h-screen w-full bg-black flex justify-center p-4 pt-10">
      <div className="w-full max-w-xl">
        {view === "payment" && (
          <PaymentView 
            chargerId={id || MOCK_CHARGER.id} 
            onStart={handleStartCharging} 
          />
        )}
        
        {view === "active" && (
          <ActiveView 
            progress={progress} 
            stats={stats} 
            onStopConfirm={handleStopSession} 
          />
        )}
        
        {view === "summary" && (
          <SummaryView stats={stats} />
        )}
      </div>
    </div>
  );
}