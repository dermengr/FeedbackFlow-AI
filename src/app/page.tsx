import { redirect } from "next/navigation";

export default function Home() {
  // Authenticated users go to the dashboard; middleware bounces others to /login.
  redirect("/dashboard");
}
