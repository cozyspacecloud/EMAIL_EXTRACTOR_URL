# Email Extractor Pro Dashboard

This is the premium Next.js frontend for your Email Extractor. It allows you to trigger the `email.py` script and see results in real-time.

## Prerequisites
- **Python 3.x** and **Playwright** installed (for the extractor script).
- **Node.js 18+** (for the dashboard).

## Getting Started

1. **Install Dependencies** (if not already done):
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Run the Dashboard**:
   ```bash
   npm run dev
   ```

3. **Access the UI**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features
- **Real-time Logs**: See exactly what the Python script is doing (loading homepage, inspecting content, etc.).
- **Live Results**: Extracted emails appear instantly as cards on the right.
- **Glassmorphism UI**: A stunning, modern dark-mode aesthetic.
- **No Script Changes**: Your existing `email.py` is used as-is.
