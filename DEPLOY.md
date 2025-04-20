# Deployment Instructions for MetaResearch Site

This document outlines all the steps taken to get the site running on the DigitalOcean.

---

## 1. Provisioning the Server on DigitalOcean

- Create a new Ubuntu-based droplet on [DigitalOcean](https://www.digitalocean.com/).
- Select a node.js/nginx image if available
- Generate an SSH key locally if you don't already have one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

- Copy the public key to your clipboard:
  ```bash
  cat ~/.ssh/id_ed25519.pub
  ```
- Go to https://cloud.digitalocean.com/account/security
- Click 'Add SSH Key', paste your key, and give it a name
- Then create your droplet and select that SSH key
- Once the droplet is created, connect to the server via SSH:
  ```bash
  ssh root@164.92.210.200
  ```

```bash
ssh root@164.92.210.200
```

---

## 2. Installing Required Packages

Install `make`, build tools, and Node.js dependencies:

```bash
apt update
apt install -y make build-essential
```

If not already installed, install Node.js and npm using `nvm` or from NodeSource.

---

## 3. Cloning the Repositories

Clone both frontend and backend repositories:

```bash
git clone https://github.com/lahnstrom/vis-nordic.git
git clone https://github.com/lahnstrom/detection-tool.git
```

Navigate to each repo and install dependencies:

```bash
cd vis-nordic
npm install

cd ../detection-tool/prototype
npm install
```

---

## 4. Building the Frontend and Copying to the Backend

From within the `vis-nordic` folder:

```bash
npm run build
```

Then copy the build output into the backend's `build` folder:

```bash
cp -r build ../detection-tool/prototype/build
```

---

## 5. Configuring Nginx

Edit the default site config:

```bash
nano /etc/nginx/sites-available/default
```

Ensure the following:

- Replace the config with the one kept in this repository under nginx/default
- SSL and redirect blocks are configured (automatically added by Certbot)

Reload Nginx:

```bash
nginx -t
systemctl reload nginx
```

---

## 6. Running the Server with PM2

From inside the `detection-tool/prototype` project directory:

```bash
pm2 start index.js --name detection-tool
```

---

## 7. Ensuring PM2 Persistence

Save the current process list and enable startup on boot:

```bash
pm2 save
pm2 startup
```

Follow the output instructions to run the `systemctl` command that sets up the startup script.

---

## 8. Setting Up SSL with Certbot

Install Certbot and the Nginx plugin:

```bash
apt install certbot python3-certbot-nginx -y
```

Run Certbot to enable HTTPS:

```bash
certbot --nginx -d metaresearch.se -d www.metaresearch.se
```

Choose the option to redirect HTTP to HTTPS when prompted.

Verify auto-renewal is working:

```bash
certbot renew --dry-run
```

---

✅ Deployment complete! Your site should now be accessible at https://metaresearch.se with a secure SSL certificate and a persistent Node.js backend.
