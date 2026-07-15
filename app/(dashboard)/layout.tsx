import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex-1 bg-neutral-50 p-8 dark:bg-neutral-900 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}
