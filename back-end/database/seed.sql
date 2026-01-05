-- 1. Βασική Πολιτική Τιμολόγησης (Για να μην έχουν 0 τιμή οι φορτιστές)
INSERT INTO PricingPolicy (policy_id, policy_type, name, fixed_price_kwh, margin_kwh, session_fee)
VALUES ('POL_DEFAULT', 'Standard', 'Default Policy', 0.30, 0.05, 1.00);

-- 2. Test User (Για να δουλεύουν τα Sessions και Reservations)
INSERT INTO User (user_id, email, password_hash, full_name, phone_number)
VALUES ('USR_001', 'testuser@wattever.gr', 'dummyhash123', 'Test User', '6900000000');

-- 3. Test Vehicle (Για να δουλεύει το /newsession)
INSERT INTO Vehicle (vehicle_id, brand, model, license_plate, battery_size_kwh, user_id)
VALUES ('VEH_001', 'Tesla', 'Model 3', 'IEE-1234', 75.0, 'USR_001');