# Soundara Security Implementation - Phase 0 Installation Guide

## 🚀 Quick Start

This guide will walk you through implementing all Phase 0 security features for Soundara.

---

## Step 1: Install New Dependencies

```bash
# Navigate to your project directory
cd /path/to/soundara

# Install new security packages
pip install python-jose[cryptography]==3.3.0
pip install passlib[bcrypt]==1.7.4
pip install bcrypt==4.1.2
pip install python-magic==0.4.27
pip install python-dotenv==1.0.0

# Or install all from updated requirements.txt
pip install -r requirements.txt
```

---

## Step 2: Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Generate a secure JWT secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output and paste it into .env as JWT_SECRET_KEY

# Edit .env file with your actual values
nano .env  # or vim .env, or code .env
```

### Required Environment Variables:

```bash
# Minimum required for Phase 0:
JWT_SECRET_KEY=your-generated-secret-key-here
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
ALLOWED_ORIGINS=http://localhost:5173,https://soundara.co
```

---

## Step 3: Update Your Backend Files

### Option A: Backup and Replace (Recommended for First Time)

```bash
# Backup your current main.py
cp backend/main.py backend/main.py.backup

# Replace with the new secure version
cp backend/main_secure.py backend/main.py
```

### Option B: Manual Integration (If You Have Custom Changes)

If you've made custom changes to `main.py`, you'll need to manually integrate the security features. Key changes:

1. Import all security modules at the top
2. Add middleware (security headers, rate limiting)
3. Add input validation to all endpoints
4. Update CORS and allowed origins to use environment variables

---

## Step 4: Set Up Stripe Webhooks

### 4.1 Configure Webhook in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL:
   - Development: `http://localhost:8000/webhook/stripe`
   - Production: `https://soundara.co/webhook/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret and add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### 4.2 Update Checkout Sessions

The new main.py automatically includes metadata in checkout sessions, but verify your Stripe price IDs:

```bash
# In .env, add your actual Stripe price IDs:
STRIPE_PRICE_LIMITED=price_1xxxxx  # From Stripe Dashboard
STRIPE_PRICE_UNLIMITED=price_2xxxxx
```

---

## Step 5: Test the Security Features

### 5.1 Test Rate Limiting

```bash
# Start your server
cd backend
uvicorn main:app --reload

# In another terminal, test rate limiting:
for i in {1..70}; do curl http://localhost:8000/library/; done

# You should see a 429 error after 60 requests
```

### 5.2 Test Input Validation

```python
# Test with Python requests
import requests

# This should fail validation (invalid user_id)
response = requests.post(
    "http://localhost:8000/user_library/../../etc/passwd/add",
    json={"track": "test"}
)
print(response.json())  # Should return 400 error
```

### 5.3 Test File Upload Security

```bash
# Try uploading a non-audio file (should fail)
curl -X POST "http://localhost:8000/process/" \
  -F "file=@test.txt" \
  -F "track_name=Test" \
  -F "mode=alpha"

# Should return: "File extension not allowed"
```

---

## Step 6: Production Deployment

### 6.1 Update DigitalOcean Droplet

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Navigate to your project
cd /path/to/soundara

# Pull latest changes
git pull origin main

# Install new dependencies
pip install -r requirements.txt

# Set production environment variables
nano .env

# Update these for production:
ENVIRONMENT=production
ALLOWED_ORIGINS=https://soundara.co,https://www.soundara.co
JWT_SECRET_KEY=your-production-secret-key

# Restart your service
systemctl restart soundara  # or however you're running the app
```

### 6.2 Set Up HTTPS (If Not Already Done)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d soundara.co -d www.soundara.co

# Certbot will automatically configure nginx
```

### 6.3 Update Nginx Configuration

```nginx
# /etc/nginx/sites-available/soundara

server {
    listen 80;
    server_name soundara.co www.soundara.co;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name soundara.co www.soundara.co;

    ssl_certificate /etc/letsencrypt/live/soundara.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/soundara.co/privkey.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Stripe webhook endpoint (no rate limiting)
    location /webhook/stripe {
        proxy_pass http://127.0.0.1:8000/webhook/stripe;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 7: Monitor Security Logs

```bash
# View security logs
tail -f logs/security.log

# View access logs
tail -f logs/access.log

# View error logs
tail -f logs/error.log

# Monitor for suspicious activity
grep "suspicious" logs/security.log
grep "rate_limit_exceeded" logs/security.log
```

---

## Step 8: Frontend Updates (Optional but Recommended)

### 8.1 Update API Calls to Include Auth Headers

If implementing JWT authentication for users (future enhancement), update frontend:

```javascript
// frontend/src/utils/api.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Add auth token to requests
export async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
  }
  
  return response;
}
```

### 8.2 Update Environment Variables

```bash
# frontend/.env
VITE_API_URL=https://soundara.co
```

---

## Step 9: Security Checklist

Before going live, verify:

- [ ] `.env` file has strong JWT_SECRET_KEY (32+ characters)
- [ ] ENVIRONMENT set to "production" on server
- [ ] HTTPS is working (test at https://soundara.co)
- [ ] Stripe webhook endpoint is accessible
- [ ] Rate limiting is working (test with curl loop)
- [ ] File upload validation is working
- [ ] Security headers are present (check in browser DevTools)
- [ ] Logs directory exists and is writable
- [ ] All secrets are in `.env`, not in code
- [ ] `.env` is in `.gitignore`

---

## Step 10: Testing Guide

### Test 1: Rate Limiting

```bash
# Should succeed 60 times, then fail
for i in {1..70}; do 
  echo "Request $i"
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/library/
done
```

Expected: First 60 return `200`, then `429`

### Test 2: Path Traversal Protection

```bash
curl "http://localhost:8000/user_library/../../../etc/passwd"
```

Expected: `400 Bad Request - Invalid user_id format`

### Test 3: File Upload Validation

```bash
# Create a fake audio file (actually a text file)
echo "not audio" > fake.wav

curl -X POST "http://localhost:8000/process/" \
  -F "file=@fake.wav" \
  -F "track_name=Test" \
  -F "mode=alpha"
```

Expected: `400 Bad Request - Invalid audio file`

### Test 4: SQL Injection Prevention

```bash
curl -X POST "http://localhost:8000/process/" \
  -F "track_name=Test'; DROP TABLE users;--" \
  -F "mode=alpha"
```

Expected: `400 Bad Request - Track name contains invalid characters`

### Test 5: Stripe Webhook

```bash
# Use Stripe CLI to test webhooks
stripe listen --forward-to localhost:8000/webhook/stripe

# In another terminal, trigger test event
stripe trigger checkout.session.completed
```

Expected: Log message showing webhook received and processed

---

## Troubleshooting

### Issue: "Module not found: backend.auth"

**Solution:**
```bash
# Make sure __init__.py exists in backend/
touch backend/__init__.py

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: "python-magic not working on Windows"

**Solution:**
```bash
# Install python-magic-bin instead
pip uninstall python-magic
pip install python-magic-bin==0.4.14
```

### Issue: Rate limiting not working

**Solution:**
```bash
# Check that middleware is added in main.py
# Verify rate_limit.py is imported correctly
# Check logs for any errors
tail -f logs/app.log
```

### Issue: Stripe webhook signature verification fails

**Solution:**
```bash
# Verify STRIPE_WEBHOOK_SECRET is correct
# Check that you're using the signing secret, not the API key
# Test with Stripe CLI: stripe listen --forward-to localhost:8000/webhook/stripe
```

---

## Performance Considerations

### Rate Limiting Memory Usage

The current implementation uses in-memory storage for rate limiting. For production with high traffic:

1. **Consider Redis** (for distributed rate limiting):
```bash
pip install redis
```

Update `rate_limit.py` to use Redis instead of in-memory dictionaries.

2. **Periodic Cleanup** (if staying with in-memory):
```python
# Add to main.py
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(
    func=rate_limiter._clean_old_entries,
    trigger="interval",
    minutes=60
)
scheduler.start()
```

---

## Next Steps

After Phase 0 is complete and tested:

1. **Monitor logs** for 1-2 weeks to identify any issues
2. **Collect metrics** on rate limiting hits, failed validations
3. **Plan V1 implementation** (Custom Frequencies, Mode Playlists)
4. **Set up automated backups** for user data
5. **Consider database migration** (Phase 2 requirement)

---

## Support & Questions

If you encounter issues:

1. Check logs: `tail -f logs/error.log`
2. Verify environment variables: `cat .env`
3. Test individual components (see Testing Guide above)
4. Review error messages for specific guidance

**Need help?** Let me know and I'll debug with you! 🛸

---

## Security Maintenance

### Weekly Tasks:
- [ ] Review security logs for suspicious activity
- [ ] Check for failed login patterns
- [ ] Monitor rate limit violations

### Monthly Tasks:
- [ ] Update dependencies: `pip list --outdated`
- [ ] Review and rotate secrets if needed
- [ ] Check SSL certificate expiration
- [ ] Review access logs for patterns

### Quarterly Tasks:
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Review and update security policies
