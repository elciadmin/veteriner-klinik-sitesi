import DashboardClient from "./dashboard-client";
import { financePageUser } from "@/lib/finance-auth";

export default async function Home() {
  const user = await financePageUser();
  if (!user) {
    return (
      <main className="finance-access-denied">
        <section>
          <span>GÜVENLİ FİNANS ALANI</span>
          <h1>Erişim doğrulanamadı</h1>
          <p>Finans sistemini Elçi Yönetim Merkezi içindeki “Finans yönetimi” bağlantısından açın.</p>
        </section>
      </main>
    );
  }
  return <DashboardClient currentUser={user} />;
}
