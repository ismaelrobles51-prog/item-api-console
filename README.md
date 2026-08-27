# Item AI API Operations

A standalone Next.js dashboard generated around `src/data/openapi.json`, the authoritative API contract. It organizes 464 operations into the contract's 48 tagged modules, generates request forms from parameters and request bodies, and sends validated requests through a server-side proxy.

## Setup

```bash
npm install
cp .env.example .env.local
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

Open `http://localhost:3000`. Remove placeholder URLs from `.env.local` until real endpoints are available; the dashboard deliberately shows a pending connection instead of sample data.

## Environment

`ITEM_API_BASE_URL` sets a shared upstream base URL. A module can override it with `ITEM_API_<MODULE>_BASE_URL`, where the OpenAPI tag is normalized to uppercase snake case. For example:

```dotenv
ITEM_API_BASE_URL=https://api.example.com
ITEM_API_TRIP_DISPATCH_BASE_URL=https://dispatch-api.example.com
```

The supplied contract has no servers, security schemes, or authenticated operations: every operation explicitly declares `security: []`. Accordingly, this build performs unauthenticated requests and never invents an auth header. The proxy supports server-only API key, bearer, and basic credentials if those schemes are later declared in the authoritative contract; the placeholder variable patterns are documented in `.env.example`.

## Security

- Production accepts base URLs only from server environment variables. Browser overrides are local-development conveniences stored in `localStorage`.
- Secrets are read only inside the proxy route, never serialized to the UI, and `.env*` files are ignored except for `.env.example`.
- The proxy accepts only operations and inputs declared in the bundled contract, blocks undeclared authentication, strips sensitive response headers, uses a 30-second timeout, and caps displayed response bodies at 5 MB.
- Development browser overrides block private-network targets unless `ITEM_API_ALLOW_PRIVATE_HOSTS=true` is set intentionally.
- Pages emit `Content-Security-Policy: frame-ancestors *` and no `X-Frame-Options`, allowing iframe embedding. Restrict `frame-ancestors` to trusted hosts in deployments that do not require open embedding.

Non-sensitive UI preferences such as operation filters and development base URL overrides are stored only in the browser. No database is used.
