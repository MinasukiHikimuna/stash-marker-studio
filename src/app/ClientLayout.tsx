"use client";

import { ConfigProvider } from "../contexts/ConfigContext";
import ReduxProvider from "../components/ReduxProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReduxProvider>
      <ConfigProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <main>
            {children}
          </main>
        </div>
      </ConfigProvider>
    </ReduxProvider>
  );
}
