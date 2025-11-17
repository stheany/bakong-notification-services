-- Insert ADMIN_USER role users for SIT environment
-- Users: Nguon Rithy, Lun Sim, Meng Horng, Vandoeurn, Seth Sambo, So Theany
-- Password hash for password "1234qwer"
-- Usernames with spaces preserved

-- Clear existing users (optional - uncomment if you want to start fresh)
-- DELETE FROM public."user" WHERE role = 'ADMIN_USER';

-- Insert Nguon Rithy
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'Nguon Rithy',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Nguon Rithy',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

-- Insert Lun Sim
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'Lun Sim',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Lun Sim',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

-- Insert Meng Horng
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'Meng Horng',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Meng Horng',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

-- Insert Vandoeurn
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'Vandoeurn',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Vandoeurn',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

-- Insert Seth Sambo
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'Seth Sambo',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Seth Sambo',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

-- Insert So Theany
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'So Theany',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'So Theany',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "failLoginAttempt" = 0,
    "updatedAt" = EXCLUDED."updatedAt",
    "deletedAt" = NULL;

