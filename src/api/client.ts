import { createClient } from "@supabase/supabase-js";
import { createSupabaseBrowserConfig } from "./config";

const supabaseConfig = createSupabaseBrowserConfig(import.meta.env);
const browserStorage = typeof window === "undefined" ? undefined : window.localStorage;

export const supabaseStatus = {
  ready: supabaseConfig.ready,
  reason: supabaseConfig.reason,
};

export const supabase = supabaseStatus.ready
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, browserStorage
    ? {
        auth: {
          // A person has one secure Night Economy session. Venue access is
          // determined by their server-enforced membership, not browser tabs.
          storage: browserStorage,
          storageKey: "night-economy-auth",
        },
      }
    : undefined)
  : null;
