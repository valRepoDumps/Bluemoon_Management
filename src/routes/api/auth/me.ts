import type { APIEvent } from "@solidjs/start/server";
import { ApiResponse } from "~/server/api/ApiResponse";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import { getSessionUser } from "~/server/service/auth";

export async function GET({ request }: APIEvent) {
  try {
    const sql = getDb();
    const session = await getSessionUser(sql, request);

    if (!session) {
      return Response.json(
        new ApiResponse(ErrorCodes.UNAUTHENTICATED, {
          message: "Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.",
        }),
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { user: session.user }),
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Session lookup error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: "Không thể xác thực phiên đăng nhập.",
      }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
