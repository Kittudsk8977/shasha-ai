export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-white/60 max-w-prose">
        Wire this page up to real session data once NextAuth is configured:
        credit balance from `user.creditBalance`, recent jobs from
        `GenerationJob`, and a "Quick create" panel that POSTs to
        `/api/v1/image/generate` (or video/voice/music) and then polls
        `/api/v1/jobs/[id]` until the status is COMPLETED or FAILED.
      </p>
    </main>
  );
}
