"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConfigPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to server configuration by default
    router.replace("/config/server");
  }, [router]);

  return null;
}
