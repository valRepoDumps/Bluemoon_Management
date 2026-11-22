import type { APIEvent } from "@solidjs/start/server";
import { ApiResponse } from "~/server/api/ApiResponse";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import {
  buildClearedSessionCookieHeader,
  isSameOriginRequest,
  logoutSession,
} from "~/server/service/auth";

export async function POST({ request }: APIEvent) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      new ApiResponse(ErrorCodes.FORBIDDEN, {
        message: "Yêu cầu không hợp lệ.",
      }),
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const sql = getDb();
    await logoutSession(sql, request);

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { message: "Đăng xuất thành công." }),
      {
        status: 200,
        headers: {
          "Set-Cookie": buildClearedSessionCookieHeader(),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Logout error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: "Lỗi hệ thống khi đăng xuất.",
      }),
      {
        status: 500,
        headers: {
          "Set-Cookie": buildClearedSessionCookieHeader(),
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
