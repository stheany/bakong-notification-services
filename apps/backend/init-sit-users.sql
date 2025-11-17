-- Insert 2 new admin users for SIT environment
-- Users: Ios Mobile and Android Mobile

-- Disable triggers temporarily
ALTER TABLE public."user" DISABLE TRIGGER ALL;

-- Insert Ios Mobile admin user
-- Password hash for default password "admin123" (can be changed later)
INSERT INTO public."user" (username, password, "displayName", "failLoginAttempt", "createdAt", "updatedAt", "deletedAt", role) 
VALUES (
    'ios-mobile',
    '$2b$10$ko6nN/cHAelEXBGu2lt6guCQt.rP.S6LDSMPlep9yTh/doZjABtn6',
    'Ios Mobile',
    0,
    NOW(),
    NOW(),
    NULL,
    'ADMIN_USER'
)
ON CONFLICT (username) DO NOTHING;

-- Insert Android Mobile admin user
-- Password hash for default password "admin123" (can be changed later)
INSERT INTO public."user" (username, password, "displayName", "failLoginAttempt", "createdAt", "updatedAt", "deletedAt", role) 
VALUES (
    'android-mobile',
    '$2b$10$ko6nN/cHAelEXBGu2lt6guCQt.rP.S6LDSMPlep9yTh/doZjABtn6',
    'Android Mobile',
    0,
    NOW(),
    NOW(),
    NULL,
    'ADMIN_USER'
)
ON CONFLICT (username) DO NOTHING;

-- Re-enable triggers
ALTER TABLE public."user" ENABLE TRIGGER ALL;

