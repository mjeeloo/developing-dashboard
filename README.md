# Developing workspace dashboard

A lightweight React dashboard that highlights ClickUp tasks from the Developing workspace with
support and operational risk context.

## Features

- Key indicators that count tasks tagged with `Vulnerability`, tagged with `Downtime`, and marked as
  `Urgent` priority.
- A dedicated table with every task carrying the `Support` tag so customer-impacting tickets stay
  visible.
- Grouped task summaries by assignee (including unassigned work) to help balance workloads.
- Sample ClickUp task data stored locally in `src/data/tasks.js` that you can swap with live API
  results or exports.

## Getting started

Install dependencies and launch the Vite development server:

```bash
npm install
npm run dev
```

The app will be available on [http://localhost:5173](http://localhost:5173).

To build a production bundle:

```bash
npm run build
```

## Connecting to ClickUp

This dashboard now reads tasks directly from the ClickUp API. Create a `.env.local` file in the
project root and provide the following variables:

```bash
VITE_CLICKUP_API_TOKEN=pk_123456_your_token_here
VITE_CLICKUP_LIST_ID=901234567
```

- `VITE_CLICKUP_API_TOKEN` should be a ClickUp personal token with permission to read the desired
  list.
- `VITE_CLICKUP_LIST_ID` is the numeric list ID that you want to monitor.

You can also copy the provided `.env.local.example` file and replace the placeholder values with
your real credentials:

```bash
cp .env.local.example .env.local
```

Restart the dev server after changing environment variables. When the app loads it will call
`https://api.clickup.com/api/v2/list/<LIST_ID>/task` and surface the live data in the Support table,
assignee workload section, and key metrics.

## Dependencies

The dashboard relies on the following npm packages:

- [`react`](https://www.npmjs.com/package/react)
- [`react-dom`](https://www.npmjs.com/package/react-dom)
- [`vite`](https://www.npmjs.com/package/vite)
- [`@vitejs/plugin-react`](https://www.npmjs.com/package/@vitejs/plugin-react)
