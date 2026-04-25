import { ChartsView } from "./charts-view";
import { requireUser } from "@/lib/session";

// Rendered on demand — data changes per cycle and DB isn't reachable at
// build time. Tag-based cache invalidation keeps cost low at runtime.
export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const { id, email } = await requireUser();
  return <ChartsView userId={id} userEmail={email} monthAnchor={null} />;
}
