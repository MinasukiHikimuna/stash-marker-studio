"use client";

import { ConfigProvider } from "../contexts/ConfigContext";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ConfigProvider>{children}</ConfigProvider>;
}
