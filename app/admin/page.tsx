import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | HBA Free Tickets", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <Dashboard />;
}
