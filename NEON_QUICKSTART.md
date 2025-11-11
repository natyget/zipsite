# Neon Quick Start Guide

Get started with Neon database in 5 minutes!

## Prerequisites

- Neon account ([sign up free](https://neon.tech))
- Node.js 20+ installed
- This project dependencies installed (`npm install`)

## Quick Setup (3 Steps)

### 1. Create Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click "Create a project"
3. Choose a name and region
4. Copy your connection string (includes `?sslmode=require`)

### 2. Configure Environment

**Option A: Use setup script (easiest)**
```bash
./scripts/setup-neon.sh
```

**Option B: Manual setup**
Create `.env` file:
```env
DB_CLIENT=pg
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
SESSION_SECRET=$(openssl rand -base64 32)
```

### 3. Run Migrations & Test

```bash
# Test connection
npm run test:db

# Run migrations
npm run migrate

# (Optional) Seed sample data
npm run seed

# Start server
npm start
```

## Verify Setup

✅ **Connection test passed** - Database is connected  
✅ **Migrations ran** - Tables are created  
✅ **Server starts** - Application is ready  

## Common Commands

```bash
# Test database connection
npm run test:db

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start development server
npm run dev

# Start production server
npm start
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check DATABASE_URL, ensure Neon project is active |
| SSL required | Add `?sslmode=require` to DATABASE_URL |
| Migration errors | Check if tables already exist, verify DATABASE_URL |
| Slow queries | Use connection pooling (pooled connection string from Neon) |

## Next Steps

- 📖 Read [NEON_SETUP.md](./NEON_SETUP.md) for detailed guide
- 🚀 Deploy to production (see [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md))
- 🔍 Monitor your database in [Neon Dashboard](https://console.neon.tech)

## Need Help?

- Check [NEON_SETUP.md](./NEON_SETUP.md) for detailed troubleshooting
- Review Neon docs: [neon.tech/docs](https://neon.tech/docs)
- Test connection: `npm run test:db`

---

**That's it!** Your Neon database is ready to use. 🎉

