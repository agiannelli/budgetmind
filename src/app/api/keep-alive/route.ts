import { NextResponse } from "next/server";
import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

// Keeps the Supabase free-tier project from auto-pausing after ~7 days idle.
// A Vercel cron (see vercel.json) hits this daily; the trivial query below
// counts as database activity and resets the idle timer. Not user-facing.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the
  // CRON_SECRET env var is set, so only the scheduled job can trigger a ping.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase-not-configured" },
      { status: 200 },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("categories").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
}
