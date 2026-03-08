import { NextRequest, NextResponse } from "next/server";
import { runDailyToolsAgent } from "@/lib/agents/daily-tools-agent";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runDailyToolsAgent();

    return NextResponse.json({
      success: true,
      message: "Daily cron executed",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        message: "Cron execution failed",
        error: message,
      },
      { status: 500 }
    );
  }
}
