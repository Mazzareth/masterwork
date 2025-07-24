# Masterwork

Welcome to Masterwork, the ultimate platform for the "FightClub" Discord community's 5v5 League of Legends in-house games.

## Project Overview

Masterwork is designed to enhance the competitive experience for FightClub members by providing a comprehensive system for:

*   **Queue System:** A robust queue for individual players to join 5v5 matches.
*   **Team Management:** Team captains can create and manage their own teams, including inviting, kicking, and substituting players in designated roles (Top, Jungle, Mid, ADC, Support).
*   **Challenge System:** Captains can challenge other teams to scheduled battles.
*   **Stat Tracking:** Tracks individual and team performance, champion picks, and team compositions for leaderboards.

## Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Daisy UI](https://daisyui.com/)
*   **Database:** Google Cloud Firebase
*   **Authentication:** Google Firebase Authentication
*   **Discord Integration:** Masterwork Discord Application for account linking.
*   **Deployment:** [Vercel](https://vercel.com/)

## Getting Started

First, ensure you have `pnpm` installed. Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This project requires the following environment variables to be set up in a `.env.local` file. Please ask the project administrator for the correct values.

```
# Firebase Configuration
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Discord Configuration
DISCORD_SECRET=
DISCORD_CLIENT_ID=

# Google OAuth Configuration
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
