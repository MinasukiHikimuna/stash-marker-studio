"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarkerIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to search page if no sceneId is provided
    router.push("/search");
  }, [router]);

  return (
    <div className="container mx-auto p-4">
      <div className="text-center text-white">Redirecting to scene search...</div>
    </div>
  );
}