import { NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/serverConfig";

export async function POST(request: NextRequest) {
  const { STASH_URL, STASH_API_KEY } = getServerConfig();
  const endpoint = STASH_URL;
  const apiKey = STASH_API_KEY;

  if (!endpoint || !apiKey) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const body = await request.json();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in proxy:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching data" },
      { status: 500 }
    );
  }
}
