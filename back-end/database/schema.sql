USE wattever_db; 

-- Station ( Physical location of charging hubs)

CREATE TABLE Station (
    station_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    latitude DECIMAL(10,8) NOT NULL,
    longtitude DECIMAL(11,8) NOT NULL
);

-- Pricing policy (Internal rules for pricing and fees)

CREATE TABLE PricingPolicy (
    policy_id VARCHAR(50) PRIMARY KEY,
    policy_type VARCHAR(50),
    name VARCHAR(100),
    fixed_price_kwh DECIMAL(10,2), 
    margin_kwh DECIMAL(10,2),
    session_fee DECIMAL (10,2) DEFAULT 0.00,
    grace_period_minutes INT DEFAULT 0
);

-- WHOLESALE PRICE (Costs from Energy Provider API)
CREATE TABLE WholesalePrice (
    price_id VARCHAR(50) PRIMARY KEY,
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    price_per_kwh DECIMAL(10, 4) NOT NULL,
    source VARCHAR(100)
);

--  USER (Drivers and Admins)
CREATE TABLE User (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt/Argon2 only
    full_name VARCHAR(255),
    phone_number VARCHAR(20)
);

-- VEHICLE (Used to calculate battery capacity for pre-auth)
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

--  PAYMENT METHOD (PCI-DSS compliant tokens)
CREATE TABLE PaymentMethod (
    payment_method_id VARCHAR(50) PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL, -- Token from PSP
    last_four VARCHAR(4),
    is_default BOOLEAN DEFAULT FALSE,
    user_id VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

--  CHARGER (Physical hardware units)
CREATE TABLE Charger (
    charger_id VARCHAR(50) PRIMARY KEY,
    connector_type VARCHAR(50),
    current_type VARCHAR(20), -- AC/DC
    max_power_kw DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, RESERVED
    station_id VARCHAR(50),
    policy_id VARCHAR(50),
    FOREIGN KEY (station_id) REFERENCES Station(station_id),
    FOREIGN KEY (policy_id) REFERENCES PricingPolicy(policy_id)
);

--  RESERVATION (Temporary holds)
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

--  CHARGING SESSION (Core operational data)
CREATE TABLE ChargingSession (
    session_id VARCHAR(50) PRIMARY KEY,
    start_time DATETIME NOT NULL,
    charging_end_time DATETIME, -- Energy flow stop
    session_end_time DATETIME,   -- Cable unplugged
    total_kwh DECIMAL(10, 3),
    total_cost DECIMAL(10, 2),
    status VARCHAR(50), -- IN_PROGRESS, COMPLETED, FAILED
    user_id VARCHAR(50),
    charger_id VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (charger_id) REFERENCES Charger(charger_id)
);

-- TRANSACTION (Financial logs)
CREATE TABLE Transaction (
    transaction_id VARCHAR(50) PRIMARY KEY,
    psp_reference_id VARCHAR(255), -- ID from Payment Gateway
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50), -- PRE_AUTH, CAPTURE, REFUND
    status VARCHAR(50), -- SUCCESS, FAILED, VOIDED
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(50),
    FOREIGN KEY (session_id) REFERENCES ChargingSession(session_id)
);
