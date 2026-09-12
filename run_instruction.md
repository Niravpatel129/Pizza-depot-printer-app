# Build and Run Instructions

## Prerequisites

- Node.js 20 or newer
- npm
- A supported desktop OS with access to the target receipt printer
- Native build tools may be required for the `printer` module

## Install

```bash
git clone https://github.com/Niravpatel129/Pizza-depot-printer-app.git
cd Pizza-depot-printer-app
npm install
```

If the native printer dependency needs rebuilding for the installed Electron version:

```bash
npm run rebuild:printer
```

## Run in development

```bash
npm start
```

## Run tests

```bash
npm test
```

## Package the application

Create an unpacked package:

```bash
npm run package
```

Create platform installers/artifacts:

```bash
npm run make
```

The `publish` script uploads release artifacts, so only run it when release credentials are configured and publishing is intended.