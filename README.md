# Developing workspace dashboard

A lightweight React dashboard that highlights ClickUp tasks from the Developing workspace with
support and operational risk context.

## Features

- Key indicators that count tasks tagged with `Vulnerability`, tagged with `Downtime`, and marked as
  `Urgent` priority.
- A dedicated table with every task carrying the `Support` tag so customer-impacting tickets stay
  visible.
- Grouped task summaries by assignee (only showing tasks with an assigned owner) to help balance
  workloads.

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
- Optionally, set `VITE_CLICKUP_API_BASE_URL` if you need to point at a proxy or self-hosted API
  endpoint. When this variable is not provided the app will talk directly to the ClickUp REST API.

You can also copy the provided `.env.local.example` file and replace the placeholder values with
your real credentials:

```bash
cp .env.local.example .env.local
```

Restart the dev server after changing environment variables. During local development the Vite
server proxies API requests to avoid browser CORS errors, so the app will call
`/clickup-api/list/<LIST_ID>/task` and surface the live data in the Support table, assignee workload
section, and key metrics.

### Custom field requirements

The dashboard relies on a ClickUp **custom field** named `Tags` to categorize tasks for the Support
table and the key indicators. Configure this field as a Labels/Multi-select field and apply the
values `Support`, `Vulnerability`, and `Downtime` (along with any others you wish to surface). The
native ClickUp tag system is ignored—only the selections in the `Tags` custom field will appear in
the dashboard.

## Dependencies

The dashboard relies on the following npm packages:

- [`react`](https://www.npmjs.com/package/react)
- [`react-dom`](https://www.npmjs.com/package/react-dom)
- [`vite`](https://www.npmjs.com/package/vite)
- [`@vitejs/plugin-react`](https://www.npmjs.com/package/@vitejs/plugin-react)
