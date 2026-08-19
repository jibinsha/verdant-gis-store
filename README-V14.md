# Verdant GIS Store V14

V14 is based directly on the uploaded STORE13 project. The existing store,
GIS explorer/map, customer dashboard, Razorpay checkout/verification and secure
download implementation are retained.

## V14 changes

- Admin Portal has a visible Sign out button in the top navigation.
- Admin Dashboard has a second visible Sign out action.
- Admin sign out clears the Supabase session and returns to `/`.
- Admin email can be allowlisted at the database level.
- New allowlisted admin signups receive `profiles.role = 'admin'`.
- Normal signups remain `customer`.
- Admin dataset INSERT/UPDATE/DELETE RLS policies are included.
- No sample datasets, orders or customer accounts are inserted by V14.

## Admin setup

1. Open `supabase/v14_admin.sql`.
2. Replace `YOUR_ADMIN_EMAIL@example.com` with your actual admin email.
3. Run the SQL in Supabase.
4. Put the same email in the frontend `.env`:
   `VITE_ADMIN_EMAIL=your-real-admin-email@example.com`
5. If the Auth account already existed before the SQL was run, execute the
   commented UPDATE statement in `v14_admin.sql`.
6. Create/sign in using the admin email.

Routing:

- Admin signup/login -> `/admin`
- Customer signup/login -> `/dashboard`

## Frontend

```powershell
npm install
npm run dev
```

## Backend

```powershell
cd server
npm install
npm run dev
```

Do not commit `.env`. Use `.env.example` as the template.

## Important

Keep the Supabase service-role key and Razorpay secret only in `server/.env`.
Never put those secrets in a `VITE_*` variable.
