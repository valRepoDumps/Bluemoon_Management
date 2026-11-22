import type { APIEvent } from "@solidjs/start/server";
import { ApiResponse } from "~/server/api/ApiResponse";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import {
  buildSessionCookieHeader,
  isSameOriginRequest,
  loginUser,
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

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      new ApiResponse(ErrorCodes.VALIDATION_ERROR, {
        message: "Dữ liệu yêu cầu không hợp lệ.",
      }),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  try {
    const sql = getDb();
    const result = await loginUser(sql, email, password);

    if (!result.ok) {
      return Response.json(
        new ApiResponse(result.code, { message: result.message }),
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { user: result.data.user }),
      {
        status: 200,
        headers: {
          "Set-Cookie": buildSessionCookieHeader(result.data.rawToken),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: "Lỗi hệ thống khi đăng nhập. Vui lòng thử lại sau.",
      }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
