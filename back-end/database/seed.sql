USE wattever_db;

-- 1. Insert Initial Stations (from sample "Location" objects)
INSERT INTO Station (station_id, name, address, latitude, longtitude) VALUES
('984769', 'GIAGKAS - loop global', 'Isiodou 7, Koropi 194 00, Greece', 37.87398985, 23.86992920),
('601404', 'DEI blue - Lavrio Port', 'Lavrion port, Lavrio 195 00, Greece', 37.71138688, 24.05604776),
('360407', 'Apollonion Bakery', '38th km Athinon-Souniou, Lagonisi', 37.79946500, 23.87060100);

-- 2. Insert Pricing Policy (Needed before adding Chargers)
INSERT INTO PricingPolicy (policy_id, policy_type, name, margin_kwh, session_fee) VALUES
('POL_DEFAULT', 'Standard', 'Default Margin', 0.15, 1.00);

-- 3. Insert Chargers (from sample "outlets" and "stations")
-- Connector mapping: 13 -> CCS1, 7 -> Type 2, 20 -> CCS2
INSERT INTO Charger (charger_id, connector_type, current_type, max_power_kw, status, station_id, policy_id) VALUES
('4704813', 'CCS1', 'DC', 50.00, 'AVAILABLE', '984769', 'POL_DEFAULT'),
('3508687', 'Type 2', 'AC', 22.00, 'AVAILABLE', '601404', 'POL_DEFAULT'),
('3596378', 'CCS2', 'DC', 150.00, 'AVAILABLE', '601404', 'POL_DEFAULT'),
('4429403', 'Type 2', 'AC', 22.00, 'AVAILABLE', '360407', 'POL_DEFAULT');

-- 4. Insert test user and vehicle for your initial testing
INSERT INTO User (user_id, email, password_hash, full_name) VALUES
('USR_001', 'tester@example.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6L6s57WyHYy6S.R6', 'Test Driver');

INSERT INTO Vehicle (vehicle_id, brand, model, license_plate, port_type, battery_size_kwh, user_id) VALUES
('VEH_001', 'Tesla', 'Model 3', 'ABC-1234', 'Type 2', 75.00, 'USR_001');
