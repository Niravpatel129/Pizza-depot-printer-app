# Pizza Depot Printer App

Pizza Depot Printer App is a desktop printing utility for restaurant operations. It is built with Electron and designed to run as a tray-style application that connects operational order/receipt workflows to local thermal printers.

The repository contains executable desktop app code, printer integration logic, packaging configuration, update tooling, and tests for important renderer settings behavior.

## Core capabilities

- Desktop tray application for printer operations
- Local printer configuration and settings screens
- Thermal printer integration
- Receipt/order printing workflows
- Electron packaging and distribution setup
- Auto-update support
- Renderer tests for settings behavior

## Tech stack

- Electron
- React
- JavaScript
- Electron Builder
- electron-updater
- node-thermal-printer
- printer integration libraries
- Jest / Testing Library

## Repository structure

Common areas include:

- `src/main/` - Electron main process logic
- `src/renderer/` - renderer UI and settings screens
- `src/renderer/views/` - app views
- `src/renderer/views/__tests__/` - renderer tests
- `assets/` - desktop app assets
- build/package configuration in `package.json`

Exact folder names may vary as the app evolves.

## Getting started

### Prerequisites

- Node.js
- npm
- A supported desktop environment
- Local printer access for full printing tests

### Install dependencies

```bash
npm install
```

### Start development mode

```bash
npm run dev
```

Check `package.json` for the current development, build, package, and release scripts.

## Testing

Run the test suite with:

```bash
npm test
```

The repository includes renderer-level tests for printer/settings-related behavior.

## Build and release

The app includes Electron packaging and update dependencies. Typical release workflows include:

```bash
npm run build
npm run dist
```

Script names may vary. Use `package.json` as the source of truth for the current packaging commands.

## Configuration notes

Printer behavior may depend on local operating system permissions, printer drivers, network printer configuration, and connected thermal printer hardware.

Before packaging or sharing:

1. Remove local printer credentials or machine-specific configuration
2. Exclude build outputs and generated release artifacts
3. Verify printer settings with a test printer
4. Confirm update/publish configuration is safe for the target environment

## Code quality notes

This project demonstrates a focused real-world desktop utility with Electron process separation, local hardware integration, packaging configuration, auto-update support, and automated tests around key settings flows.
