"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navigationPersistence } from "@/utils/navigationPersistence";

const CONFIG_TABS = [
  { id: "server", label: "Basic", path: "/config/basic" },
  { id: "markers", label: "Marker Groups", path: "/config/markers" },
  { id: "derived-markers", label: "Derived Markers", path: "/config/derived-markers" },
  { id: "slot-definitions", label: "Slot Definitions", path: "/config/slot-definitions" },
  { id: "shot-boundary", label: "Shot Boundary", path: "/config/shot-boundary" },
  { id: "video-playback", label: "Video Playback", path: "/config/video-playback" },
  { id: "keyboard", label: "Keyboard Shortcuts", path: "/config/keyboard" },
];

export default function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleBackNavigation = () => {
    const previousPage = navigationPersistence.getPreviousPage();
    if (previousPage) {
      navigationPersistence.clearPreviousPage();
      router.push(previousPage.path);
    } else {
      // Fallback to search page if no previous page stored
      router.push('/search');
    }
  };

  const previousPage = navigationPersistence.getPreviousPage();

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Configuration</h1>
          {previousPage && (
            <button
              onClick={handleBackNavigation}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              title={`Back to ${navigationPersistence.getPageTitle(previousPage.path)}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>Back to {navigationPersistence.getPageTitle(previousPage.path)}</span>
            </button>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            {CONFIG_TABS.map((tab) => {
              const isActive = pathname === tab.path;
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    isActive
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {children}
      </div>
    </div>
  );
}