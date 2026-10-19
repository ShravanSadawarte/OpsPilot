import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Always evaluate at request time: the redirect depends on the session cookie.
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  redirect(session?.user ? "/dashboard" : "/login");
}
