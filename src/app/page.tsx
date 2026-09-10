import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/currentProfile";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "parent" ? "/profiles" : "/home");
}
