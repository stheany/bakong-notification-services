-- Insert ADMIN_USER role users for SIT environment
-- Users: Nguon Rithy, lun sim, Meng horng, Vandoeurn, Seth Sambo, So Theany
-- Password hash for default password "1234qwer"

-- Insert Nguon Rithy
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'nguon-rithy',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Nguon Rithy',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

-- Insert lun sim
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'lun-sim',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'lun sim',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

-- Insert Meng horng
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'meng-horng',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Meng horng',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

-- Insert Vandoeurn
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'vandoeurn',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Vandoeurn',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

-- Insert Seth Sambo
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'seth-sambo',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'Seth Sambo',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

-- Insert So Theany
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'so-theany',
    '$2b$10$KXqEgbKH0pKbYTZ9jKFVgOhiUQLOsdcaOpEXjKWdqBh70lua2YIEG',
    'So Theany',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    role = EXCLUDED.role,
    "updatedAt" = EXCLUDED."updatedAt";

