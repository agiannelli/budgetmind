import "server-only";

import { auth0 } from "@/lib/auth0";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  auth0_sub: string;
  email: string | null;
};

/**
 * Resolve the Auth0 identity to our `users` row, creating it on first login.
 *
 * The insert fires the `seed_user_defaults` trigger (default categories,
 * envelopes, and profile rows). Returns `null` if Supabase isn't configured yet,
 * so auth can be brought up before the database — callers should tolerate null.
 */
export async function ensureUser(input: {
  sub: string;
  email?: string | null;
}): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      { auth0_sub: input.sub, email: input.email ?? null },
      { onConflict: "auth0_sub" },
    )
    .select("id, auth0_sub, email")
    .single();

  if (error) {
    throw new Error(`Failed to ensure user: ${error.message}`);
  }

  return data as AppUser;
}

/**
 * The current signed-in app user, or null if there's no session. Safe to call
 * from server components and server actions; guarantees the `users` row exists.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  return ensureUser({ sub: session.user.sub, email: session.user.email });
}

/** Like getCurrentUser but throws if unauthenticated — for mutations. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  return user;
}
