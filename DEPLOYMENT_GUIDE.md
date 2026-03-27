# Jenkins Dashboard Deployment Guide

To let others in **OFBusiness** use this dashboard, you can host it on your local machine or a server within the network.

## 1. Prerequisites
Ensure you have **Node.js** installed on the machine that will host the dashboard.

## 2. Recommended: Git Deployment
Using a Git repository is much cleaner than `scp`.

### On your Local Machine
1. **Initialize Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Jenkins Dashboard"
   ```
2. **Push to Your Repo**:
   Create a private repository (e.g., on GitHub/Bitbucket) and run:
   ```bash
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

### On the UAT2 Server (10.22.0.132)
1. **Clone the Repo**:
   ```bash
   ssh root@10.22.0.132
   git clone YOUR_REPO_URL /root/jenkins-dashboard
   cd /root/jenkins-dashboard
   npm install
   ```
2. **Update later**:
   Just run `git pull` and `pm2 restart jenkins-dashboard`.

---

## 3. Keep the Server Running (PM2)
To prevent the dashboard from closing when you exit the terminal, use **PM2** (Process Manager 2).

### Install PM2
```bash
npm install -g pm2
```

### Start the Dashboard
Replace the credentials with your actual Jenkins username and token.
```bash
JENKINS_USER=your_user JENKINS_TOKEN=your_token pm2 start index.js --name "jenkins-dashboard"
```

### Manage the Service
- **Check status**: `pm2 status`
- **View logs**: `pm2 logs`
- **Restart**: `pm2 restart jenkins-dashboard`
- **Stop**: `pm2 stop jenkins-dashboard`

---

## 4. How Others Can Access It
Colleagues can access the dashboard using your computer's **Local IP Address**.

### Find Your IP (Mac/Linux)
Run this command in your terminal:
```bash
ipconfig getifaddr en0
```
*(Example output: `192.168.1.52`)*

### Share the URL
Tell your team to open this in their browser:
`http://10.22.0.132:5001` (Using the UAT2 IP).

---

## 4. Troubleshooting
- **Firewall**: Ensure your computer allows incoming connections on port `5001`.
- **Jenkins Access**: The machine hosting this dashboard must be able to reach `https://stg-jenkins.ofbusiness.co.in`.
- **VPN**: If people are working remotely, they must be on the **OFBusiness VPN** to access your local machine's IP.
