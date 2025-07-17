import { getServerConfig } from "@/serverConfig";
import { NextResponse } from "next/server";

export async function GET() {
  const config = getServerConfig();
  return NextResponse.json(config);
}
