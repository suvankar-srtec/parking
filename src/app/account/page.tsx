import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  redirect("/dashboard");
}
