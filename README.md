🏆 Project Submission: Multi-Agent Sales Field AI Routing Assistant
A professional, synchronized multi-agent assistant designed to optimize sales field operations. The system helps business development managers and field representatives plan routes, perform client research, record visit notes, and generate intelligent daily reports.

📖 Project Overview
Field sales representatives frequently struggle with two distinct problems:

Inefficient Routing: Outbound sales reps spend hours manually planning visit sequences, travel times, and breaks.
Lack of Instant Field Intelligence: Reps arrive at client locations without immediate context, notes, or tailored company insights.
This project delivers a unified multi-agent ecosystem consisting of a Next.js Web Dashboard (for route planning and business research) and a React Native Mobile App (for representatives in the field), fully synchronized via a central PostgreSQL database.

🎨 Unified System Features
1. Web Manager Dashboard (apps/web)
Interactive Route Optimizer: Plan client visit schedules, set departure points, and configure preparation buffer times.
Yelp Restaurant Advisor: Automatically recommends verified local lunch spots along the travel route.
BD Consultant Panel: Processes prospect company names or URLs to extract firmographics, products, financial summaries, and recommend custom SFI shipping solutions.
2. Companion Mobile App (apps/mobile)
Dynamic Route Selection: Pulls synced trips from the server and displays complete stop details, timeline event sequences, and maps.
Live Check-In / Check-Out: Tracks reps' arrival times, check-out metrics, and manual/automatic visit states.
Voice-to-Text Transcription: Visit reflections recorded via the mic are automatically transcribed and associated with the client.
Sleek Dark Mode: Responsive HSL-tailored colors, biometric Face ID verification support, and smooth micro-animations.
3. Key Robustness & Sync Features
Self-Healing Silent Re-Auth: Automatically catches expired session states (401 Unauthorized) and triggers silent re-login to renew tokens without disrupting the user flow.
Biometric Security Fallback: Leverages native hardware biometrics (Face ID/Fingerprint) to authenticate securely.
Structured Mobile Markdown Rendering: Includes a custom parser that converts markdown headers, lists, checkboxes, and tables into native iOS/Android layout cards.

Codebase Architecture
fieldroute-ai/
├── apps/
│   ├── web/             # Next.js Web Application & API handlers (deployed on Vercel)
│   │   └── src/app/     # Page views (bd-consultant, trip planning, auth, APIs)
│   └── mobile/          # Expo Go React Native Mobile Application
│       ├── App.tsx      # Main application controller, loaders, UI screens, and modals
│       └── src/lib/     # Local timeline calculation and route sequence heuristics
├── package.json         # Workspace project configurations
└── README.md            # Root developer setup guide

