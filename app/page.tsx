import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import DizkosApp from "./DizkosApp";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <DizkosApp />;
}