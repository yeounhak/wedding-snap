This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Generation Access Setup

Apply the Supabase migration in `supabase/migrations` before enabling generation
in a shared environment. It creates the private `wedding-snap-jobs` storage
bucket, generation jobs, anonymous quota windows, login unlocks, payment orders,
and credit ledger tables.

Required server environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
OPENAI_API_KEY=
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
```

`NEXT_PUBLIC_TOSS_CLIENT_KEY` and `TOSS_SECRET_KEY` must be the Toss Payments
payment-widget integration keys, not the API individual integration keys. The
credit page renders the payment-widget order form in-page before requesting the
final Toss payment.

Optional policy/product variables:

```bash
WEDDING_SNAP_DEVICE_SECRET=
WEDDING_SNAP_STORAGE_BUCKET=wedding-snap-jobs
WEDDING_SNAP_ANONYMOUS_IP_DAILY_LIMIT=6
WEDDING_SNAP_CREDIT_PACK_SKU=wedding-snap-credit-5
WEDDING_SNAP_CREDIT_PACK_NAME=웨딩 스냅 5장 크레딧
WEDDING_SNAP_CREDIT_PACK_AMOUNT=3900
WEDDING_SNAP_CREDIT_PACK_CREDITS=5
```

Temporal worker deployment variables:

```bash
TEMPORAL_TASK_QUEUE=wedding-snap-image-generation
TEMPORAL_WORKER_VERSIONING=off
TEMPORAL_WORKER_DEPLOYMENT_NAME=wedding-snap-worker
APP_BUILD_ID=
```

Local development should normally keep `TEMPORAL_WORKER_VERSIONING=off`. In
production, set `TEMPORAL_WORKER_VERSIONING=required` for both Vercel and the
worker VM. Vercel should expose system environment variables so
`VERCEL_GIT_COMMIT_SHA` is available at runtime; the VM deployment injects the
same value as `APP_BUILD_ID`.

Anonymous users can generate one watermarked image per device quota window.
Kakao login can unlock that same device's anonymous result once without another
OpenAI generation. Paid users spend one credit per clean generation.

## Worker CI/CD

Vercel continues to deploy the Next.js app from `main`. The Temporal worker is
deployed by `.github/workflows/worker.yml`:

1. build and typecheck the worker image from `Dockerfile.worker`
2. push the image to Google Artifact Registry as `${GITHUB_SHA}` and `main`
3. copy `scripts/deploy-worker-vm.sh` to the GCE worker VM
4. stop older worker units/containers and start one SHA-specific Podman/systemd worker service
5. promote that SHA with `temporal worker deployment set-current-version`

The VM deploy keeps a single active worker process. Older
`wedding-snap-worker-*.service` units and their Podman containers are disabled
and removed during each successful deployment so a small VM does not run
multiple worker versions at the same time.

Required GitHub repository variables:

```bash
GCP_PROJECT_ID=
GCP_REGION=asia-northeast3
GCP_ARTIFACT_REPOSITORY=wedding-snap
GCP_WORKER_VM_NAME=
GCP_WORKER_VM_ZONE=
GCP_WORKLOAD_IDENTITY_PROVIDER=
GCP_SERVICE_ACCOUNT=
TEMPORAL_WORKER_DEPLOYMENT_NAME=wedding-snap-worker
WEDDING_SNAP_WORKER_ENV_FILE=/etc/wedding-snap/worker.env
WEDDING_SNAP_WORKER_STOP_TIMEOUT_SECONDS=30
```

The worker VM must have Podman, Google Cloud CLI, Temporal CLI, and
`/etc/wedding-snap/worker.env`. That env file contains runtime secrets such as
Temporal, Supabase, and OpenAI credentials, but should not contain
`APP_BUILD_ID`; the deploy script sets it per commit.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
