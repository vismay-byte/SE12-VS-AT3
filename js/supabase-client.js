// Creates the shared Supabase client with the public anon key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://zjqtryslahtkvfndmagd.supabase.co";
const SUPABASE_KEY = "sb_publishable_B5TvDyElhDLoVfc6m2CFsA_XC1z52xc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
