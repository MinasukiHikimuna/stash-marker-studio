"use client";

import { ConfigProvider } from "../contexts/ConfigContext";
import ReduxProvider from "../components/ReduxProvider";
import Navigation from "../components/Navigation";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReduxProvider>
      <ConfigProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <Navigation />
          <main>
            {children}
          </main>
        </div>
      </ConfigProvider>
    </ReduxProvider>
  );
}
