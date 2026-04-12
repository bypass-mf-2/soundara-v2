# Phase 0 Security Implementation - Quick Checklist

## ✅ Complete Implementation Checklist

### Pre-Implementation
- [ ] Backup current codebase: `cp -r soundara soundara_backup`
- [ ] Backup database files: `cp *.json backups/`
- [ ] Document current configuration

### File Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Generate JWT secret: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] Fill in all environment variables in `.env`
- [ ] Add `.env` to `.gitignore`

### New Files Created
- [ ] `backend/auth.py` - JWT authentication
- [ ] `backend/rate_limit.py` - Rate limiting middleware
- [ ] `backend/logging_config.py` - Logging system
- [ ] `backend/webhooks.py` - Stripe webhook handler
- [ ] `backend/cyber_prevention.py` - Updated with comprehensive validation
- [ ] `backend/main_secure.py` - Secure version of main.py

### Dependencies
- [ ] Install: `pip install python-jose[cryptography]==3.3.0`
- [ ] Install: `pip install passlib[bcrypt]==1.7.4`
- [ ] Install: `pip install bcrypt==4.1.2`
- [ ] Install: `pip install python-magic==0.4.27`
- [ ] Install: `pip install python-dotenv==1.0.0`
- [ ] Or run: `pip install -r requirements.txt`

### Backend Migration
- [ ] Replace `backend/main.py` with `backend/main_secure.py`
- [ ] Verify all imports work
- [ ] Create `logs/` directory: `mkdir -p logs`
- [ ] Test server starts: `uvicorn backend.main:app --reload`

### Stripe Configuration
- [ ] Get Stripe webhook secret from dashboard
- [ ] Add webhook endpoint: `https://soundara.co/webhook/stripe`
- [ ] Select webhook events (see INSTALLATION_GUIDE.md)
- [ ] Add webhook secret to `.env`
- [ ] Add Stripe price IDs to `.env`

### Testing (Local)
- [ ] Test rate limiting: `for i in {1..70}; do curl http://localhost:8000/library/; done`
- [ ] Test invalid file upload
- [ ] Test path traversal protection
- [ ] Test SQL injection prevention
- [ ] Test Stripe webhook with Stripe CLI
- [ ] Check logs are being created: `ls -la logs/`

### Production Deployment
- [ ] SSH into DigitalOcean droplet
- [ ] Pull latest code: `git pull origin main`
- [ ] Copy `.env.example` to `.env` on server
- [ ] Fill in production environment variables
- [ ] Set `ENVIRONMENT=production`
- [ ] Update allowed origins
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Restart service

### HTTPS & Nginx
- [ ] Verify SSL certificate is active
- [ ] Update nginx configuration with security headers
- [ ] Test nginx config: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`
- [ ] Test HTTPS access: `https://soundara.co`

### Post-Deployment Verification
- [ ] Visit https://soundara.co - should load with HTTPS
- [ ] Check security headers in browser DevTools
- [ ] Test file upload from frontend
- [ ] Test payment flow end-to-end
- [ ] Monitor logs: `tail -f logs/app.log`
- [ ] Check for errors: `tail -f logs/error.log`

### Monitoring (Week 1)
- [ ] Day 1: Check logs every few hours
- [ ] Day 2-3: Check logs daily
- [ ] Day 4-7: Monitor for rate limit hits
- [ ] Look for suspicious activity patterns
- [ ] Verify webhook events are being received

### Documentation
- [ ] Update team documentation
- [ ] Document new environment variables
- [ ] Update deployment procedures
- [ ] Create runbook for common issues

---

## 🔥 Critical Commands Reference

### Generate JWT Secret
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Test Rate Limiting
```bash
for i in {1..70}; do curl http://localhost:8000/library/; done
```

### View Logs
```bash
tail -f logs/security.log
tail -f logs/error.log
tail -f logs/access.log
```

### Test Stripe Webhook
```bash
stripe listen --forward-to localhost:8000/webhook/stripe
stripe trigger checkout.session.completed
```

### Restart Server (systemd)
```bash
sudo systemctl restart soundara
sudo systemctl status soundara
```

---

## 📝 Environment Variables Required

```bash
# CRITICAL - Must be set
JWT_SECRET_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# IMPORTANT - Should be set
ENVIRONMENT=production
ALLOWED_ORIGINS=https://soundara.co

# OPTIONAL - Have defaults
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=500
MAX_FILE_SIZE_MB=50
```

---

## ⚠️ Common Issues & Quick Fixes

### Issue: Server won't start
```bash
# Check for import errors
python -c "import backend.auth"
python -c "import backend.rate_limit"

# Check logs
tail -20 logs/error.log
```

### Issue: Rate limiting not working
```bash
# Verify middleware is loaded
grep "rate_limit_middleware" backend/main.py

# Check for errors
grep "rate" logs/error.log
```

### Issue: Webhook signature fails
```bash
# Verify webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Test with Stripe CLI
stripe listen --forward-to localhost:8000/webhook/stripe
```

---

## 🎯 Success Criteria

Phase 0 is successfully implemented when:

- ✅ All 12 security vulnerabilities are fixed
- ✅ Rate limiting blocks excessive requests (429 errors after limit)
- ✅ File uploads are validated (rejects invalid files)
- ✅ Input validation prevents injection attacks
- ✅ Stripe webhooks confirm payments automatically
- ✅ HTTPS is enforced in production
- ✅ Security headers are present
- ✅ Logs are being written
- ✅ No errors in production logs for 48 hours

---

## 📊 Estimated Timeline

- **Setup & Dependencies**: 30 minutes
- **File Migration**: 1 hour
- **Testing Locally**: 1 hour
- **Production Deployment**: 1 hour
- **Verification & Monitoring**: 2 hours

**Total**: ~5-6 hours for complete implementation

---

## 🚨 Emergency Rollback

If something breaks in production:

```bash
# Revert to backup
cd /path/to/soundara
git checkout HEAD~1

# Or restore from backup
cp -r /path/to/soundara_backup/* /path/to/soundara/

# Restart service
sudo systemctl restart soundara
```

---

## 📞 Who to Contact

- **Backend Issues**: Check logs first, then review INSTALLATION_GUIDE.md
- **Stripe Issues**: Check Stripe Dashboard > Webhooks for delivery status
- **Server Issues**: Check systemd logs: `journalctl -u soundara -n 50`

---

## 🎉 After Phase 0

Once everything is working smoothly:

1. Monitor for 1 week
2. Collect metrics on security events
3. Begin planning V1 features (Custom Frequencies)
4. Schedule regular security reviews
5. Set up automated backups

**Ready to start? Begin with the Pre-Implementation checklist!** 🛸
