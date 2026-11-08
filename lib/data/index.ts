import { supabaseSource } from "./supabase-source";
import type { DataSource } from "./source";

export const data: DataSource = supabaseSource;

export { AccountRequiredError, SessionClosedError } from "./source";
export type { DataSource } from "./source";
