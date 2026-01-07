import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Χρησιμοποιούμε axios όπως και στον χάρτη για συνέπεια

function ReservationPage() {
  const { id } = useParams(); // Παίρνει το ID από το URL (π.χ. 1024)
  const navigate = useNavigate();

  // --- STATE ---
  const [minutes, setMinutes] = useState(30); // Default 30 λεπτά
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State για την επιτυχία και τον χρόνο που απομένει
  const [reservationData, setReservationData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // --- TIMER LOGIC (Αντίστροφη μέτρηση) ---
  useEffect(() => {
    if (!timeLeft || timeLeft <= 0) return;

    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft]);

  // --- HELPER: Format Time (mm:ss) ---
  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // --- ACTION: ΚΟΥΜΠΙ ΔΕΣΜΕΥΣΗΣ ---
  const handleReserve = async () => {
    setError(null);
    setLoading(true);

    // 1. Προσομοίωση Payment Gateway (Use Case Step 9)
    // Καθυστερούμε 2 δευτερόλεπτα για να φανεί "real"
    await new Promise(resolve => setTimeout(resolve, 2000));

    // (Προαιρετικό) Τυχαία αποτυχία πληρωμής για να δεις το Error UI
    // if (Math.random() > 0.9) { 
    //   setError("Payment Declined: Insufficient Funds"); 
    //   setLoading(false); 
    //   return; 
    // }

    try {
      // 2. Κλήση στο Backend (POST /api/reserve/{id}/{minutes})
      // Χρησιμοποιούμε το axios.post
      const res = await axios.post(`http://127.0.0.1:8000/api/reserve/${id}/${minutes}`);
      
      const data = res.data; // Το axios έχει τα δεδομένα στο .data

      // 3. Υπολογισμός χρόνου που απομένει για το Timer
      const end = new Date(data.reservationendtime).getTime();
      const now = new Date().getTime();
      const secondsLeft = Math.floor((end - now) / 1000);

      // 4. Ενημέρωση State -> Εμφάνιση Success Screen
      setReservationData(data);
      setTimeLeft(secondsLeft);

    } catch (err) {
      // Διαχείριση λαθών από το Backend (π.χ. Race Condition)
      const errorMsg = err.response?.data?.detail || err.message || "Reservation failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- ΟΘΟΝΗ ΕΠΙΤΥΧΙΑΣ (Use Case Step 11) ---
  if (reservationData) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: '60px' }}>✅</div>
          <h1 style={{color: '#28a745'}}>Reservation Successful!</h1>
          
          <p>Charger ID: <strong>{reservationData.pointid}</strong></p>
          <p>Status: <strong>{reservationData.status}</strong></p>

          {/* Active Timer Bar */}
          <div style={styles.timerBox}>
             Time Remaining: <br/>
             <span style={{fontSize: '2em'}}>{timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}</span>
          </div>

          <p style={{fontSize: '0.9em', color: '#666'}}>Please arrive before the timer expires.</p>

          <button onClick={() => navigate('/')} style={styles.secondaryButton}>
            Return to Map
          </button>
        </div>
      </div>
    );
  }

  // --- ΟΘΟΝΗ ΦΟΡΜΑΣ (Use Case Steps 6-8) ---
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        <h2>Reserve Charger {id}</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Select arrival time to calculate fee.
        </p>

        {/* Επιλογή Χρόνου */}
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          Arrival in (minutes):
        </label>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
          {[15, 30, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              style={{
                ...styles.timeButton,
                backgroundColor: minutes === m ? '#007bff' : '#f9f9f9',
                color: minutes === m ? 'white' : '#333',
                borderColor: minutes === m ? '#007bff' : '#ddd',
              }}
            >
              {m}'
            </button>
          ))}
        </div>

        {/* Πληροφορίες Κόστους */}
        <div style={styles.costBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
            <span>Reservation Fee:</span>
            <strong>0.50 €</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Simulated payment via Card •••• 4242
          </div>
        </div>

        {/* Μήνυμα Λάθους */}
        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        {/* Κουμπί Πληρωμής */}
        <button 
          onClick={handleReserve}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            backgroundColor: loading ? '#6c757d' : '#28a745',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Processing Payment...' : 'Pay 0.50€ & Reserve'}
        </button>

        <button onClick={() => navigate('/')} style={styles.secondaryButton}>
          Cancel
        </button>

      </div>
    </div>
  );
}

// --- CSS STYLES (Μέσα στο αρχείο για ευκολία) ---
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '50px',
    backgroundColor: '#f4f4f9',
    minHeight: '90vh',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '15px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center'
  },
  timeButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: '0.2s'
  },
  costBox: {
    backgroundColor: '#f0f8ff',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #cce5ff',
    textAlign: 'left'
  },
  errorBox: {
    color: '#721c24',
    backgroundColor: '#f8d7da',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    textAlign: 'left'
  },
  primaryButton: {
    width: '100%',
    padding: '15px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  secondaryButton: {
    width: '100%',
    padding: '10px',
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  timerBox: {
    backgroundColor: '#4caf50', 
    color: 'white', 
    padding: '20px', 
    borderRadius: '10px', 
    margin: '20px 0',
    fontWeight: 'bold'
  }
};

export default ReservationPage;
