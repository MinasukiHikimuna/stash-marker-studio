"use client";

import { usePathname } from "next/navigation";
import { ConfigProvider } from "../contexts/ConfigContext";
import ReduxProvider from "../components/ReduxProvider";
import { ConfigGuard } from "../components/ConfigGuard";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Don't apply ConfigGuard to config pages
  const shouldApplyGuard = !pathname.startsWith('/config');

  return (
    <ReduxProvider>
      <ConfigProvider>
        {shouldApplyGuard ? (
          <ConfigGuard>
            <div className="min-h-screen bg-gray-900 text-white">
              <main>
                {children}
              </main>
            </div>
          </ConfigGuard>
        ) : (
          <div className="min-h-screen bg-gray-900 text-white">
            <main>
              {children}
            </main>
          </div>
        )}
      </ConfigProvider>
    </ReduxProvider>
  );
}
