"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    console.log("Home page: redirecting to /search");
    router.replace("/search");
  }, [router]);

  console.log("Home page: rendering");

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div>Loading...</div>
    </div>
  );
}
