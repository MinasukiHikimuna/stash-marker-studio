"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { validateConfiguration } from "@/utils/configValidation";
import type { AppConfig } from "@/serverConfig";

interface ConfigGuardProps {
  children: React.ReactNode;
}

// Routes that require complete configuration
const protectedRoutes = ['/search', '/marker'];

export function ConfigGuard({ children }: ConfigGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigComplete, setIsConfigComplete] = useState(false);

  console.log("ConfigGuard: rendering, pathname:", pathname, "isLoading:", isLoading, "isConfigComplete:", isConfigComplete);

  useEffect(() => {
    console.log("ConfigGuard: useEffect triggered for pathname:", pathname);
    
    const checkConfig = async () => {
      // Handle home page redirect
      if (pathname === '/') {
        console.log("ConfigGuard: home page, allowing through to let page handle redirect");
        setIsLoading(false);
        setIsConfigComplete(true);
        return;
      }

      console.log("ConfigGuard: checking config for protected route:", pathname);

      try {
        console.log("ConfigGuard: starting fetch to /api/config");
        
        const response = await fetch("/api/config");
        console.log("ConfigGuard: fetch response received, status:", response.status, "ok:", response.ok);
        
        if (response.status === 404 || !response.ok) {
          console.log("ConfigGuard: no config found, redirecting to basic config");
          setIsLoading(false);
          router.replace("/config/basic");
          return;
        }
        
        console.log("ConfigGuard: parsing JSON response");
        const config: AppConfig = await response.json();
        console.log("ConfigGuard: config received:", config);
        
        const validation = validateConfiguration(config);
        console.log("ConfigGuard: validation result:", validation);
        
        if (!validation.isComplete) {
          console.log("ConfigGuard: config incomplete, redirecting to basic config");
          setIsLoading(false);
          router.replace("/config/basic");
          return;
        }

        console.log("ConfigGuard: config complete, allowing access");
        setIsConfigComplete(true);
        setIsLoading(false);
      } catch (error) {
        console.error("ConfigGuard: config check failed:", error);
        setIsLoading(false);
        router.replace("/config/basic");
        return;
      }
    };

    checkConfig();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Checking configuration...</div>
          <div className="text-sm text-gray-400">Current path: {pathname}</div>
        </div>
      </div>
    );
  }

  if (!isConfigComplete && protectedRoutes.some(route => pathname.startsWith(route))) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Configuration required</div>
          <div className="text-sm text-gray-400">Redirecting to setup...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}