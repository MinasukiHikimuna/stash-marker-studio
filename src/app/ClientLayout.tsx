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
      <ConfigProvider>{children}</ConfigProvider>
    </ReduxProvider>
  );
}
