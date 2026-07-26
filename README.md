# Ambali Drive

A fullstack Cloud Storage Drive that features file/folder management, sharing functionality, and user authentication.

## Features Implemented
- Upload, rename, delete (trash/restore), and download files.
- Nested folders.
- JWT-based protected endpoints.
- Generate and manage public share links.
- User storage quota tracking (UI logic built-in).

## Environment Variables
Before running the application in any mode, copy the example environment file:
```bash
cp .env.example .env
```
Ensure you have the following setup in your `.env`:
- **Firebase**: Create a new Firebase project, enable Authentication (Email/Password & Google), and download the Admin Service Account JSON. Map these details to the `FIREBASE_*` variables in `.env`.

---

## 🚀 Production Deployment (Recommended)

The easiest way to run Ambali Drive in a production environment is using our unified Docker Compose setup. It automatically runs the Database and the combined Web Application in auto-restarting containers.

### Requirements
- Docker & Docker Compose

### Run 1-Click Deployment
```bash
docker-compose up -d --build
```
*Docker will automatically build the images, start the Postgres database, run database migrations, and serve the application on port `9000` (`http://localhost:9000`). If your server crashes or reboots, everything will start up automatically.*

---

## 🛠️ Local Development

If you want to modify the code or run it without containerizing the Node application, follow these steps:

### 1. Requirements
- Node.js (v18+)
- `pnpm` (Install via `npm i -g pnpm`)
- Docker (for the local database)

### 2. Install Dependencies
Install packages for both frontend and backend from the root directory:
```bash
pnpm install
```

### 3. Start the Database
Start the PostgreSQL database via Docker:
```bash
docker-compose up -d db
```

### 4. Initialize the Database Schema
Push the Prisma schema to the database:
```bash
cd backend
npx prisma db push
cd ..
```

### 5. Run the Application
Start both the frontend and backend simultaneously using the concurrently script:
```bash
pnpm run dev
```

- **Frontend (Development Mode):** Runs at `http://localhost:8000`
- **Backend (API):** Runs at `http://localhost:9000`
