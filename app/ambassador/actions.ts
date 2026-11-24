"use server";

import { redirect } from "next/navigation";
import { adminDb } from "@/lib/admin/auth";
import { endAmbassadorSession, startAmbassadorSession } from "@/lib/ambassador/auth";

export interface AmbassadorFormState {
  error?: string;
}

export async function ambassadorSignup(_: AmbassadorFormState, form: FormData): Promise<AmbassadorFormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (name.length < 2 || name.length > 60) return { error: "Enter your name, 2 to 60 letters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const { data, error } = await adminDb().rpc("ambassador_signup", { p_name: name, p_email: email, p_password: password });
  if (error || typeof data !== "string") {
    return { error: error?.message === "email_taken" ? "That email already has an ambassador account. Sign in instead." : "Couldn't create your account. Try again." };
  }
  await startAmbassadorSession(data);
  redirect("/ambassador");
}

export async function ambassadorLogin(_: AmbassadorFormState, form: FormData): Promise<AmbassadorFormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const { data, error } = await adminDb().rpc("ambassador_login", { p_email: email, p_password: password });
  if (error) return { error: error.message === "locked" ? "Too many wrong tries. Wait 15 minutes." : "Couldn't sign you in. Try again." };
  if (typeof data !== "string") return { error: "That email and password don't match." };
  await startAmbassadorSession(data);
  redirect("/ambassador");
}

export async function ambassadorLogout() {
  await endAmbassadorSession();
  redirect("/ambassador");
}
