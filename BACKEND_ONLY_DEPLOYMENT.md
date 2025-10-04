# Backend Only Deployment Guide
## Deploying YugaFarms Backend to api.yugafarms.com

### Prerequisites
- AWS EC2 instance running Ubuntu 22.04
- Domain: yugafarms.com (for subdomain setup)
- SSH access to your EC2 instance

## Step 1: Launch EC2 Instance

### 1.1 Create EC2 Instance
1. Go to AWS Console → EC2 → Launch Instance
2. Choose **Ubuntu Server 22.04 LTS**
3. Select **t2.micro** (Free tier) or **t3.small** (recommended)
4. Configure Security Group:
   - **SSH (22)**: Your IP only
   - **HTTP (80)**: 0.0.0.0/0
   - **HTTPS (443)**: 0.0.0.0/0
   - **Custom (1337)**: 0.0.0.0/0 (for Strapi)

### 1.2 Connect to Instance
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

## Step 2: Install Dependencies

### 2.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js (v18)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2.3 Install PM2
```bash
sudo npm install -g pm2
```

### 2.4 Install Nginx
```bash
sudo apt install nginx -y
```

### 2.5 Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
```

## Step 3: Database Setup

### 3.1 Create Database and User
```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE yugafarms_db;
CREATE USER yugafarms_user WITH PASSWORD 'YugaFarms2024!Secure';
GRANT ALL PRIVILEGES ON DATABASE yugafarms_db TO yugafarms_user;
\c yugafarms_db
GRANT ALL ON SCHEMA public TO yugafarms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yugafarms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yugafarms_user;
\q
```

## Step 4: Deploy Backend

### 4.1 Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/your-username/YugaFarms.git
cd YugaFarms/YugaFarmsBackend
```

### 4.2 Install Dependencies
```bash
npm install
```

### 4.3 Create Production Environment File
```bash
nano .env
```

```env
# Database Configuration
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=yugafarms_db
DATABASE_USERNAME=yugafarms_user
DATABASE_PASSWORD=YugaFarms2024!Secure

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

# Email Configuration (Optional)
BREVO_API_KEY=your_brevo_api_key_here
EMAIL_FROM=noreply@yugafarms.com
EMAIL_FROM_NAME=YugaFarms
EMAIL_REPLY_TO=support@yugafarms.com
```

## Step 5: Configure Nginx

### 5.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/api.yugafarms.com
```

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

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:1337/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/api.yugafarms.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Start Backend with PM2

### 6.1 Create PM2 Configuration
```bash
cd /home/ubuntu/YugaFarms
nano ecosystem-backend.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'yugafarms-backend',
      cwd: './YugaFarmsBackend',
      script: 'npm',
      args: 'run develop',
      env: {
        NODE_ENV: 'production',
        PORT: 1337
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
```

### 6.2 Start Backend
```bash
# Create logs directory
mkdir -p logs

# Start backend
pm2 start ecosystem-backend.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Step 7: Setup SSL Certificate

### 7.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2 Get SSL Certificate
```bash
sudo certbot --nginx -d api.yugafarms.com
```

## Step 8: Configure DNS

### 8.1 DNS Settings
In your domain registrar (where yugafarms.com is registered):
- **A Record**: api.yugafarms.com → Your EC2 Public IP

## Step 9: Test Deployment

### 9.1 Test Endpoints
```bash
# Test API
curl https://api.yugafarms.com/api/products

# Test admin panel
curl https://api.yugafarms.com/admin
```

### 9.2 Access Admin Panel
1. Visit: `https://api.yugafarms.com/admin`
2. Create admin account
3. Configure content types and permissions

## Step 10: Update Frontend Configuration

### 10.1 Update Frontend Environment
In your local frontend `.env.local`:
```env
NEXT_PUBLIC_BACKEND=https://api.yugafarms.com/api
```

### 10.2 Test Frontend Connection
Make sure your frontend can connect to the backend API.

## Monitoring and Maintenance

### PM2 Commands
```bash
pm2 status                    # Check backend status
pm2 logs yugafarms-backend    # View backend logs
pm2 restart yugafarms-backend # Restart backend
pm2 stop yugafarms-backend    # Stop backend
```

### Nginx Commands
```bash
sudo systemctl status nginx   # Check Nginx status
sudo systemctl restart nginx  # Restart Nginx
sudo nginx -t                 # Test Nginx configuration
```

### Database Backup
```bash
pg_dump -h localhost -U yugafarms_user yugafarms_db > backup.sql
```

## Security Checklist

- [ ] Configure firewall (ufw)
- [ ] Set up regular backups
- [ ] Monitor logs
- [ ] Keep system updated
- [ ] Use strong passwords
- [ ] Enable fail2ban
- [ ] Configure SSL
- [ ] Set up monitoring

## Troubleshooting

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

## Expected Results

After deployment:
- **API**: https://api.yugafarms.com/api
- **Admin Panel**: https://api.yugafarms.com/admin
- **Uploads**: https://api.yugafarms.com/uploads
- **Health Check**: https://api.yugafarms.com/health
