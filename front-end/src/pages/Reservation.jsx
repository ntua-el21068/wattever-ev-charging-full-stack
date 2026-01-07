import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ReservationPage() {
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

    // Fake Delay (Simulating Payment Gateway)
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/reserve/${id}/${minutes}`);
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

  // --- 1. SUCCESS SCREEN (Active Session) ---
  if (reservationData) {
    return (
      <div style={styles.mobileContainer}>
        <div style={styles.successCard}>
          <div style={styles.iconCircle}>✅</div>
          <h2 style={{ color: '#27ae60', margin: '10px 0' }}>Reserved!</h2>
          <p style={{ color: '#7f8c8d', margin: 0 }}>Charger {reservationData.pointid} is yours.</p>

          {/* Active Timer */}
          <div style={styles.timerDisplay}>
             {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
             <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>MINUTES REMAINING</div>
          </div>

          <p style={{ fontSize: '14px', color: '#95a5a6' }}>
            Drive to the station and plug in your vehicle before the timer runs out.
          </p>

          <button onClick={() => navigate('/')} style={styles.buttonOutline}>
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  // --- 2. RESERVATION FORM ---
  return (
    <div style={styles.mobileContainer}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backButton}>←</button>
        <span style={styles.headerTitle}>Reserve Spot</span>
        <div style={{ width: '30px' }}></div> {/* Spacer για κεντράρισμα */}
      </div>

      <div style={styles.content}>
        
        {/* CHARGER INFO CARD */}
        <div style={styles.infoCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Charger {id}</h3>
              <p style={{ margin: '5px 0', color: '#7f8c8d', fontSize: '14px' }}>Type 2 • 22kW • AC</p>
            </div>
            <div style={styles.statusBadge}>Available</div>
          </div>
        </div>

        {/* TIME SELECTION */}
        <h4 style={styles.sectionTitle}>Arrival Time</h4>
        <div style={styles.gridContainer}>
          {[15, 30, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              style={{
                ...styles.timeButton,
                backgroundColor: minutes === m ? '#007AFF' : '#F2F2F7',
                color: minutes === m ? 'white' : '#000',
                border: minutes === m ? 'none' : '1px solid transparent',
              }}
            >
              {m} min
            </button>
          ))}
        </div>

        {/* PAYMENT SUMMARY */}
        <h4 style={styles.sectionTitle}>Payment Method</h4>
        <div style={styles.paymentRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={styles.cardIcon}>💳</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>MasterCard •• 4242</div>
              <div style={{ fontSize: '12px', color: '#27ae60' }}>Wallet Connected</div>
            </div>
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>0.50 €</div>
        </div>

        {/* ERROR MESSAGE */}
        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

      </div>

      {/* FOOTER ACTION */}
      <div style={styles.footer}>
        <button 
          onClick={handleReserve}
          disabled={loading}
          style={{
            ...styles.payButton,
            opacity: loading ? 0.7 : 1,
            backgroundColor: loading ? '#95a5a6' : '#007AFF'
          }}
        >
          {loading ? 'Processing...' : `Pay 0.50€ & Reserve`}
        </button>
      </div>

    </div>
  );
}

// --- STYLES (Mobile App Look) ---
const styles = {
  mobileContainer: {
    backgroundColor: '#F9F9F9', // Light gray background
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: 'white',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 5px rgba(0,0,0,0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#007AFF'
  },
  headerTitle: {
    fontWeight: '600',
    fontSize: '18px'
  },
  content: {
    padding: '20px',
    flex: 1
  },
  infoCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    marginBottom: '25px'
  },
  statusBadge: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  sectionTitle: {
    margin: '0 0 10px 5px',
    fontSize: '14px',
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '10px',
    marginBottom: '25px'
  },
  timeButton: {
    padding: '12px 0',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: '0.2s'
  },
  paymentRow: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #eee',
    marginBottom: '20px'
  },
  cardIcon: {
    backgroundColor: '#f0f0f0',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '20px'
  },
  errorBox: {
    backgroundColor: '#fee',
    color: '#c0392b',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '14px',
    marginBottom: '10px'
  },
  footer: {
    padding: '20px',
    backgroundColor: 'white',
    borderTop: '1px solid #eee',
    position: 'sticky',
    bottom: 0
  },
  payButton: {
    width: '100%',
    padding: '16px',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 122, 255, 0.3)'
  },
  // Success Screen Styles
  successCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    backgroundColor: 'white'
  },
  iconCircle: {
    width: '80px',
    height: '80px',
    backgroundColor: '#e8f8f5',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '40px',
    marginBottom: '20px'
  },
  timerDisplay: {
    fontSize: '48px',
    fontWeight: '800',
    color: '#2c3e50',
    margin: '30px 0',
    fontVariantNumeric: 'tabular-nums'
  },
  buttonOutline: {
    marginTop: 'auto',
    width: '100%',
    padding: '15px',
    backgroundColor: 'transparent',
    border: '2px solid #007AFF',
    color: '#007AFF',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};

export default ReservationPage;

