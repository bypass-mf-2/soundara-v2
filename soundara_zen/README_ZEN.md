# Soundara Zen - Minimalist UI Edition 🧘

This is a complete copy of the Soundara project with the **Minimalist Zen UI** applied.

---

## 🎨 What's Different?

This version includes:
- ✅ **Minimalist Zen UI** - Clean, peaceful, meditation-focused design
- ✅ **Cream/Sage/Earth color palette** - Calming, sophisticated
- ✅ **All backend security features** from Phase 0
- ✅ **Complete frontend functionality**
- ✅ **All 6 frequency modes** (Gamma, Alpha, Beta, Theta, Delta, Schumann)
- ✅ **Production-ready** codebase

---

## 📁 Project Structure

```
soundara_zen/
├── backend/                    # FastAPI backend
│   ├── main.py                # Main application (use this)
│   ├── main_secure.py         # Alternative secure version
│   ├── auth.py                # JWT authentication
│   ├── rate_limit.py          # DDoS protection
│   ├── cyber_prevention.py    # Input validation
│   ├── logging_config.py      # Security logging
│   ├── webhooks.py            # Stripe webhooks
│   ├── payment.py             # Payment logic
│   ├── alpha/                 # Alpha wave processing
│   ├── beta/                  # Beta wave processing
│   ├── gamma/                 # Gamma wave processing
│   ├── theta/                 # Theta wave processing
│   ├── delta/                 # Delta wave processing
│   └── schumann_resonance/    # Schumann processing
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── index.css          # ⭐ ZEN UI STYLES HERE
│   │   ├── App.jsx            # Main app component
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   └── assets/            # Images, logos
│   ├── package.json
│   └── index.html
│
├── requirements.txt            # Python dependencies
├── .env.example               # Environment variables template
└── README_ZEN.md              # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Set up environment variables
cp ../.env.example .env
# Edit .env with your:
# - STRIPE_API_KEY
# - STRIPE_WEBHOOK_SECRET
# - JWT_SECRET_KEY
# - DATABASE_URL (optional)

# Run backend
python main.py
# Backend runs on http://localhost:8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### 3. Open in Browser

Navigate to: **http://localhost:5173**

You'll see the beautiful Zen UI! 🎨

---

## 🎨 Zen UI Features

### Design Philosophy
- **Minimalist** - Maximum whitespace, minimal distractions
- **Calming** - Soft earth tones reinforce meditation/wellness
- **Accessible** - 5/5 accessibility score
- **Sophisticated** - Premium feel without being overwhelming

### Color Palette
```css
--zen-white: #fdfbf7;      /* Background */
--zen-cream: #f5f1e8;      /* Secondary background */
--zen-sage: #8ba888;       /* Primary accent */
--zen-earth: #c4b59d;      /* Secondary text */
--zen-charcoal: #2d3436;   /* Primary text */
```

### Key UI Elements
- ✅ Clean navbar with subtle borders
- ✅ Soft shadow cards (no gradients)
- ✅ Gentle hover animations
- ✅ Minimalist audio player
- ✅ Peaceful upload section
- ✅ Mobile-optimized responsive design

---

## 💰 Pricing Structure

### Per Track
- **Base:** $1.70 minimum ($0.08/MB)
- **Custom Frequencies:** +$1.50

### Subscriptions
- **Limited Plan:** $12.99/month (20 tracks)
- **Unlimited Plan:** $16.99/month (unlimited)

---

## 🧠 Frequency Modes

| Mode | Frequency | Use Case |
|------|-----------|----------|
| **Gamma** | 30-100 Hz | High cognitive function, peak performance |
| **Alpha** | 8-12 Hz | Relaxed focus, creativity, calm awareness |
| **Beta** | 12-30 Hz | Alertness, problem-solving, active thinking |
| **Theta** | 4-8 Hz | Deep meditation, intuition, insights |
| **Delta** | 0.5-4 Hz | Deep sleep, healing, recovery |
| **Schumann** | 7.83 Hz | Earth's frequency, grounding, balance |

---

## 🔒 Security Features (Phase 0)

All security implementations from Phase 0 are included:

### Authentication
- ✅ JWT token-based auth
- ✅ Bcrypt password hashing
- ✅ Token expiration (30 days)
- ✅ Secure session management

### Rate Limiting
- ✅ IP-based limits (60/min, 500/hr, 5000/day)
- ✅ User-based limits
- ✅ Endpoint-specific limits
- ✅ DDoS protection

### Input Validation
- ✅ SQL injection prevention
- ✅ Path traversal prevention
- ✅ XSS prevention
- ✅ File upload validation (MIME, size, content)
- ✅ URL validation (YouTube URLs)

### Payment Security
- ✅ Stripe webhook signature verification
- ✅ Secure payment intent creation
- ✅ Transaction logging

### Monitoring
- ✅ Structured logging
- ✅ Security event tracking
- ✅ Access logs
- ✅ Error logs

---

## 📱 Mobile Responsive

The Zen UI is fully optimized for:
- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 1200px)
- ✅ Mobile (320px - 768px)

---

## 🎯 Perfect For

The Zen UI is ideal for:
- ✅ Wellness/meditation focus
- ✅ Sleep/theta/delta wave marketing
- ✅ Older demographic (30-50)
- ✅ Premium, sophisticated positioning
- ✅ Accessibility-first design
- ✅ High conversion rates

---

## 🛠️ Customization

### Changing Colors

Edit `/frontend/src/index.css`:

```css
:root {
  --zen-sage: #8ba888;     /* Change primary accent */
  --zen-earth: #c4b59d;    /* Change secondary */
  /* etc. */
}
```

### Switching UI Styles

Want to try a different UI? Replace `index.css` with any option from `UI_OPTIONS/`:
```bash
cp UI_OPTIONS/option1_glassmorphic.css frontend/src/index.css
```

---

## 📊 File Changes from Original

### Modified Files
- ✅ `frontend/src/index.css` - **Replaced with Zen UI**

### All Other Files
- ✅ **Identical to original** Soundara project
- ✅ All backend security features intact
- ✅ All frontend functionality preserved
- ✅ All frequency processing modules included

---

## 🚀 Deployment

### Backend Deployment (DigitalOcean/AWS/etc.)

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export STRIPE_API_KEY="your_key"
export JWT_SECRET_KEY="your_secret"

# Run with gunicorn (production)
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app
```

### Frontend Deployment (Vercel/Netlify/etc.)

```bash
cd frontend

# Build for production
npm run build

# Deploy the 'dist' folder
```

---

## 📝 Environment Variables

Required in `.env`:

```bash
# Stripe
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT
JWT_SECRET_KEY=your-super-secret-key-change-this

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost/soundara

# CORS (production)
FRONTEND_URL=https://soundara.co
```

---

## 🎨 UI Comparison

### Zen (This Version) vs Others

| Feature | Zen | Glassmorphic | Cyberpunk |
|---------|-----|--------------|-----------|
| **Vibe** | Peaceful | Modern | Edgy |
| **Accessibility** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Conversion** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Viral Potential** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.10+

# Check if port 8000 is free
lsof -i :8000

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+
```

### UI looks broken
```bash
# Make sure index.css was replaced correctly
cat frontend/src/index.css | head -20
# Should show Zen color variables
```

---

## 📚 Documentation

For more information:
- **Phase 0 Security:** See `PHASE0_CHECKLIST.md`
- **Implementation Roadmap:** See `IMPLEMENTATION_ROADMAP.md`
- **Advertising Strategy:** See `COMPLETE_ADVERTISING_STRATEGY.md`
- **Video Ads:** See `SOUNDARA_VIDEO_AD_SCRIPT.md`

---

## 🎯 What's Next?

### V1 Features (Weeks 4-6)
- [ ] Custom frequencies (user input)
- [ ] Mode playlists (curated collections)

### V2 Features (Weeks 7-14)
- [ ] PostgreSQL migration
- [ ] Music remix tools
- [ ] Community uploads

### V3 Features (Weeks 15-24)
- [ ] AI-generated tracks
- [ ] React Native mobile app

---

## 💬 Support

Questions? Issues?
- Check `INSTALLATION_GUIDE.md` for detailed setup
- Review `PHASE0_CHECKLIST.md` for security setup
- Open an issue on GitHub

---

## 📄 License

Same as original Soundara project.

---

**Built with ❤️ using the Minimalist Zen UI**

Transform any song into brain-enhancing frequencies. 🧘✨
