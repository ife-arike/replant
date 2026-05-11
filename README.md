# Replant

Replant is the future secure communications platform being explored through Project Replant.

Project Replant is the public mission pathway: a place to clarify the vision, begin conversations with church leaders, and test whether churches are willing to connect more intentionally across location, prayer, support, and shared burden.

Replant itself is intended to become the dedicated communication network where verified Christian leaders can correspond directly, pray together, share needs, and extend support across geography.

The goal is not to create a social media platform, ministry promotion space, or public content feed. 

## The Problem

Many churches are serving faithfully in their own communities, but there is often no trusted, structured way to communicate across churches.

Prayer needs, urgent support requests, resource gaps, missions updates, and persecuted church concerns can become scattered across group chats, social media, emails, and isolated ministry networks.

Replant is being explored as a way to create a safer, more intentional communication layer for the body of Christ.

## The Vision

Replant is being designed around location-based connection, not platform-based promotion.

The biblical pattern of addressing churches by location informs the structure of this vision. Churches should be able to see, pray, respond, and support across regions without the platform becoming centered on personalities, brands, or individual ministries.

## Core Areas

Replant will focus on:

- Prayer requests across churches and regions
- Needs-based support and resource sharing
- Persecuted church updates and prayer
- Secure church-to-church communication
- Clear moderation and safety expectations
- A future web and mobile experience

## Technical Direction

Replant is expected to require a secure communication architecture that protects users while also maintaining safety within the network.

Important technical considerations include:

- User authentication
- Church or organization verification
- Role-based access
- Encrypted communication
- Moderation workflows for harmful or unsafe activity
- Auditability for internal safety review
- Clear privacy boundaries
- Scalable web and mobile architecture

This repository will be used to document the vision, product direction, technical considerations, and roadmap as the project develops.

## Current Status

Replant is in the early vision and planning stage.

The current focus is:

- Clarifying the product vision
- Documenting the technical foundation
- Gathering feedback from church leaders
- Defining security and trust principles
- Preparing for an eventual prototype or MVP

## Repository Contents

- `VISION.md` explains the broader vision
- `PRINCIPLES.md` defines the values guiding the platform
- `SECURITY.md` outlines early security expectations
- `ROADMAP.md` tracks planned phases
- `docs/` contains supporting product and technical notes

## First-time local dev setup

The leader app is React Native via Expo. First-run setup (skeleton):

1.  **Clone the repo:**

    ```bash
    git clone https://github.com/ife-arike/replant.git
    cd replant
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Install Expo Go** on a physical device (iOS App Store or Google Play): https://expo.dev/client

4.  **Start the dev server:**

    ```bash
    npm start
    ```

    (or `npx expo start`)

5.  Scan the QR code displayed in the terminal with Expo Go on Android, or with the iOS Camera app on iOS.

<!-- TODO: expand when first dev'd locally -->

Sections still to document on first hands-on local dev session:

- `.env.local` setup and which env vars are required for what (Supabase auth, Mapbox, anon-vs-service-role boundary on the BE-via-edge-functions path)
- EAS dev build flow vs Expo Go differences (per SM `reference_replant_systems.md`: iOS dev build `fd4659a7-1e79-4fcf-bb05-1a68dcadc262`, Android dev build `aa03b6ff-cc26-4188-8dd7-ee406a3667c6`)
- Hot reload behavior + common gotchas (Metro bundler restarts, env-var hot-reload limitations)
- Login flow against `jiyetphxxvyiicrnwlnx` Supabase Auth
- Pairing with `~/replant-admin` for admin actions during smoke
- How to test against a specific branch vs main

Anchor: Expo scheme `replant`, currently on commit `5089830` on main per SM memory.

## Website

Project website coming soon at:

`projectreplant.org`

## Contributing

Replant is not currently open for public contribution.

As the project develops, this repository may be opened for trusted technical review, product feedback, and future collaboration.
