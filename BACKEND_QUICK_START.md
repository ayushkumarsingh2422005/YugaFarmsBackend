# Backend Quick Start Deployment
## Deploy YugaFarms Backend to api.yugafarms.com (15 minutes)

### Prerequisites
- AWS EC2 instance running Ubuntu 22.04
- Domain: yugafarms.com (for subdomain setup)
- SSH access to your EC2 instance

### Step 1: Connect to EC2
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Step 2: Clone and Setup
```bash
# Clone your repository
git clone https://github.com/your-username/YugaFarms.git
cd YugaFarms

# Make scripts executable
chmod +x deploy-backend.sh setup-backend-database.sh

# Run deployment script
./deploy-backend.sh
```

### Step 3: Configure Backend Environment
```bash
cd YugaFarmsBackend
nano .env
```

Paste this configuration:
```env
# Database Configuration (SQLite - Default)
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

# Server Configuration
HOST=0.0.0.0
PORT=1337
NODE_ENV=production

# Strapi Security Keys (Generate new ones for production)
APP_KEYS=your-app-keys-here
API_TOKEN_SALT=your-api-token-salt-here
ADMIN_JWT_SECRET=your-admin-jwt-secret-here
TRANSFER_TOKEN_SALT=your-transfer-token-salt-here
JWT_SECRET=your-jwt-secret-here

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_RPLaE4n5TwcMVj
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
```

### Step 4: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/api.yugafarms.com
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name api.yugafarms.com;

    # API endpoints
    location /api {
        proxy_pass http://localhost:1337/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers for frontend
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Admin panel
    location /admin {
        proxy_pass http://localhost:1337/admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Strapi uploads
    location /uploads {
        proxy_pass http://localhost:1337/uploads;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/api.yugafarms.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Start Backend
```bash
# Start with PM2
pm2 start ecosystem-backend.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 6: Setup SSL
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.yugafarms.com
```

### Step 7: Configure DNS
Point your subdomain to your EC2 instance:
- **A Record**: api.yugafarms.com → Your EC2 Public IP

## 🎉 You're Done!

Your YugaFarms backend should now be live at:
- **API**: https://api.yugafarms.com/api
- **Admin Panel**: https://api.yugafarms.com/admin

## 🔧 Useful Commands

```bash
# Check backend status
pm2 status

# View backend logs
pm2 logs yugafarms-backend

# Restart backend
pm2 restart yugafarms-backend

# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t
```

## 🆘 Troubleshooting

### Backend not starting?
```bash
pm2 logs yugafarms-backend
```

### Database connection issues?
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Nginx issues?
```bash
sudo nginx -t
sudo systemctl status nginx
```

### CORS issues?
Check the CORS headers in the Nginx configuration.

## Update Frontend Configuration

In your local frontend `.env.local`:
```env
NEXT_PUBLIC_BACKEND=https://api.yugafarms.com/api
```

## Test Your Backend

```bash
# Test API
curl https://api.yugafarms.com/api/products

# Test admin panel
curl https://api.yugafarms.com/admin
```
