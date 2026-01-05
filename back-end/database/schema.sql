CREATE DATABASE IF NOT EXISTS wattever_db;
USE wattever_db;

-- Καθαρισμός παλιών πινάκων (Drop Tables) με τη σωστή σειρά λόγω Foreign Keys
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Transaction;
DROP TABLE IF EXISTS ChargingSession;
DROP TABLE IF EXISTS Reservation;
DROP TABLE IF EXISTS StatusHistory; -- ΝΕΟΣ ΠΙΝΑΚΑΣ
DROP TABLE IF EXISTS Charger;
DROP TABLE IF EXISTS PaymentMethod;
DROP TABLE IF EXISTS Vehicle;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS WholesalePrice;
DROP TABLE IF EXISTS PricingPolicy;
DROP TABLE IF EXISTS Station;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------
-- 1. Station (Physical location of charging hubs)
-- ---------------------------------------------------------
CREATE TABLE Station (
    station_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL
);

-- ---------------------------------------------------------
-- 2. Pricing policy (Internal rules for pricing and fees)
-- ---------------------------------------------------------
CREATE TABLE PricingPolicy (
    policy_id VARCHAR(50) PRIMARY KEY,
    policy_type VARCHAR(50),
    name VARCHAR(100),
    fixed_price_kwh DECIMAL(10,2), 
    margin_kwh DECIMAL(10,2),
    session_fee DECIMAL (10,2) DEFAULT 0.00,
    grace_period_minutes INT DEFAULT 0
);

-- ---------------------------------------------------------
-- 3. WHOLESALE PRICE (Costs from Energy Provider API)
-- ---------------------------------------------------------
CREATE TABLE WholesalePrice (
    price_id VARCHAR(50) PRIMARY KEY,
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    price_per_kwh DECIMAL(10, 4) NOT NULL,
    source VARCHAR(100)
);

-- ---------------------------------------------------------
-- 4. USER (Drivers and Admins)
-- ---------------------------------------------------------
CREATE TABLE User (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20)
);

-- ---------------------------------------------------------
-- 5. VEHICLE (Used to calculate battery capacity)
-- ---------------------------------------------------------
CREATE TABLE Vehicle (
    vehicle_id VARCHAR(50) PRIMARY KEY,
    brand VARCHAR(100),
    model VARCHAR(100),
    license_plate VARCHAR(20) UNIQUE,
    port_type VARCHAR(50), -- e.g., CCS, Type 2
    battery_size_kwh DECIMAL(10, 2) NOT NULL,
    user_id VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 6. PAYMENT METHOD
-- ---------------------------------------------------------
CREATE TABLE PaymentMethod (
    payment_method_id VARCHAR(50) PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    last_four VARCHAR(4),
    is_default BOOLEAN DEFAULT FALSE,
    user_id VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 7. CHARGER (Physical hardware units)
-- ---------------------------------------------------------
CREATE TABLE Charger (
    charger_id VARCHAR(50) PRIMARY KEY,
    connector_type VARCHAR(50),
    current_type VARCHAR(20), -- AC/DC
    max_power_kw DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'AVAILABLE', -- AVAILABLE, CHARGING, RESERVED, OUTOFORDER
    station_id VARCHAR(50),
    policy_id VARCHAR(50),
    FOREIGN KEY (station_id) REFERENCES Station(station_id),
    FOREIGN KEY (policy_id) REFERENCES PricingPolicy(policy_id)
);

-- ---------------------------------------------------------
-- 8. STATUS HISTORY (ΝΕΟΣ ΠΙΝΑΚΑΣ για το Endpoint /pointstatus)
-- ---------------------------------------------------------
CREATE TABLE StatusHistory (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    point_id VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (point_id) REFERENCES Charger(charger_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 9. RESERVATION (Temporary holds)
-- ---------------------------------------------------------
CREATE TABLE Reservation (
    reservation_id VARCHAR(50) PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiration_time DATETIME NOT NULL,
    status VARCHAR(50), -- ACTIVE, EXPIRED, COMPLETED
    fee_amount DECIMAL(10, 2),
    user_id VARCHAR(50),
    charger_id VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (charger_id) REFERENCES Charger(charger_id)
);

-- ---------------------------------------------------------
-- 10. CHARGING SESSION (Updated with SOC and Vehicle Info)
-- ---------------------------------------------------------
CREATE TABLE ChargingSession (
    session_id VARCHAR(50) PRIMARY KEY,
    start_time DATETIME NOT NULL,
    charging_end_time DATETIME, -- Energy flow stop
    session_end_time DATETIME,   -- Cable unplugged
    total_kwh DECIMAL(10, 3),
    total_cost DECIMAL(10, 2),
    cost_per_kwh DECIMAL(10, 2), -- Η τιμή που ίσχυε τότε
    start_soc INT,               -- % Μπαταρίας στην αρχή
    end_soc INT,                 -- % Μπαταρίας στο τέλος
    status VARCHAR(50),          -- IN_PROGRESS, FINISHED
    user_id VARCHAR(50),
    charger_id VARCHAR(50),
    vehicle_id VARCHAR(50),      -- Ποιο όχημα φορτίστηκε
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (charger_id) REFERENCES Charger(charger_id),
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id)
);

-- ---------------------------------------------------------
-- 11. TRANSACTION (Financial logs)
-- ---------------------------------------------------------
CREATE TABLE Transaction (
    transaction_id VARCHAR(50) PRIMARY KEY,
    psp_reference_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50),
    status VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(50),
    FOREIGN KEY (session_id) REFERENCES ChargingSession(session_id)
);