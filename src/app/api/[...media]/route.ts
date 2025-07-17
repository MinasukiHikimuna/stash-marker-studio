import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ media: string[] }> }
) {
  const stashHost = process.env.STASH_HOST;
  const sessionCookie = process.env.SESSION_COOKIE;

  if (!stashHost || !sessionCookie) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const resolvedParams = await params;
  const mediaPath = resolvedParams.media.join("/");
  const url = `${stashHost}/${mediaPath}`;

  console.log("Proxying request to:", url); // Add this log

  try {
    const response = await fetch(url, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    });

    if (!response.ok) {
      console.error(
        `Error fetching media: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        {
          error: `Failed to fetch media: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      },
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching media" },
      { status: 500 }
    );
  }
}
