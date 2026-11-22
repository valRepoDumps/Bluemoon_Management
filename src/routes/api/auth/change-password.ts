import type { APIEvent } from "@solidjs/start/server";
import { ApiResponse } from "~/server/api/ApiResponse";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import {
  buildSessionCookieHeader,
  changeUserPassword,
  getSessionUser,
  isSameOriginRequest,
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

  let body: {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  };
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

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  try {
    const sql = getDb();
    const session = await getSessionUser(sql, request);

    if (!session) {
      return Response.json(
        new ApiResponse(ErrorCodes.UNAUTHENTICATED, {
          message: "Vui lòng đăng nhập để đổi mật khẩu.",
        }),
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await changeUserPassword(sql, {
      userId: session.user.id,
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!result.ok) {
      return Response.json(
        new ApiResponse(result.code, { message: result.message }),
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, {
        message: "Đổi mật khẩu thành công.",
      }),
      {
        status: 200,
        headers: {
          "Set-Cookie": buildSessionCookieHeader(result.data.rawToken),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Change password error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, {
        message: "Lỗi hệ thống khi đổi mật khẩu. Vui lòng thử lại sau.",
      }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
