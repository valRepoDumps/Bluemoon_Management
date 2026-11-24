import type { APIEvent } from "@solidjs/start/server";
import { ApiResponse } from "~/server/api/ApiResponse";
import { ErrorCodes } from "~/server/api/ErrorCode";
import { getDb } from "~/server/database/db";
import { getSessionUser, isSameOriginRequest } from "~/server/service/auth";
import { generateUUID } from "~/types/UUID";

interface ResidentView {
  id: string;
  name: string;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}

interface HouseholdView {
  id: string;
  number: string;
  status: string;
  head: ResidentView | null;
  residents: ResidentView[];
}

export async function GET({ request }: APIEvent) {
  try {
    const sql = getDb();
    const session = await getSessionUser(sql, request);
    if (!session) {
      return Response.json(
        new ApiResponse(ErrorCodes.UNAUTHENTICATED, { message: "Vui lòng đăng nhập để xem danh sách hộ gia đình." }),
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Backward-compatible migration for databases created before residents.name existed.
    await sql`ALTER TABLE residents ADD COLUMN IF NOT EXISTS name VARCHAR(255);`;
    // Backfill names for the three sample residents already stored by the original seed.
    await sql`
      UPDATE residents
      SET name = CASE phone_number
        WHEN '0912345678' THEN 'Nguyễn Văn An'
        WHEN '0987654321' THEN 'Nguyễn Thị Lan'
        WHEN '0901122334' THEN 'Trần Thị Bình'
        ELSE name
      END
      WHERE name IS NULL
        AND phone_number IN ('0912345678', '0987654321', '0901122334')
    `;

    const rows = await sql<Array<{
      household_id: string;
      number: string;
      status: string;
      head_id: string | null;
      resident_id: string | null;
      resident_name: string | null;
      phone_number: string | null;
      birth_date: string | null;
      relationship: string | null;
    }>>`
      SELECT
        h.id AS household_id,
        h.number,
        h.status,
        h.head_id,
        r.id AS resident_id,
        r.name AS resident_name,
        r.phone_number,
        TO_CHAR(r.birth_date, 'YYYY-MM-DD') AS birth_date,
        r.relationship
      FROM households h
      LEFT JOIN residents r ON r.household_id = h.id
      ORDER BY h.number, r.birth_date, r.id
    `;

    const byId = new Map<string, HouseholdView>();
    for (const row of rows) {
      let household = byId.get(row.household_id);
      if (!household) {
        household = {
          id: row.household_id,
          number: String(row.number),
          status: row.status,
          head: null,
          residents: [],
        };
        byId.set(row.household_id, household);
      }

      if (row.resident_id) {
        const resident: ResidentView = {
          id: row.resident_id,
          name: row.resident_name?.trim() || "Chưa cập nhật tên",
          phoneNumber: row.phone_number,
          birthDate: row.birth_date ?? "",
          relationship: row.relationship ?? "",
        };
        household.residents.push(resident);
        if (row.head_id === row.resident_id) household.head = resident;
      }
    }

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { households: Array.from(byId.values()) }),
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Household list error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, { message: "Không thể tải danh sách hộ gia đình." }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST({ request }: APIEvent) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      new ApiResponse(ErrorCodes.FORBIDDEN, { message: "Yêu cầu không hợp lệ." }),
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json(
      new ApiResponse(ErrorCodes.VALIDATION_ERROR, { message: "Dữ liệu gửi lên không hợp lệ." }),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const number = typeof body.number === "string" ? body.number.trim() : "";
  const headName = typeof body.headName === "string" ? body.headName.trim() : "";
  const headPhone = typeof body.headPhone === "string" ? body.headPhone.trim() : "";
  const headBirthDate = typeof body.headBirthDate === "string" ? body.headBirthDate.trim() : "";

  if (!number || number.length > 50 || !headName || headName.length > 255 || !headBirthDate) {
    return Response.json(
      new ApiResponse(ErrorCodes.VALIDATION_ERROR, { message: "Vui lòng nhập số căn hộ, tên chủ hộ và ngày sinh hợp lệ." }),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (headPhone && !/^[0-9+().\-\s]{7,20}$/.test(headPhone)) {
    return Response.json(
      new ApiResponse(ErrorCodes.VALIDATION_ERROR, { message: "Số điện thoại không hợp lệ." }),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsedBirthDate = new Date(`${headBirthDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedBirthDate.getTime()) ||
    parsedBirthDate.toISOString().slice(0, 10) !== headBirthDate ||
    parsedBirthDate.getTime() > Date.now()
  ) {
    return Response.json(
      new ApiResponse(ErrorCodes.VALIDATION_ERROR, { message: "Ngày sinh không hợp lệ." }),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const sql = getDb();
    const session = await getSessionUser(sql, request);
    if (!session) {
      return Response.json(
        new ApiResponse(ErrorCodes.UNAUTHENTICATED, { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }),
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!( ["ADMIN", "MANAGER", "STAFF"] as string[] ).includes(session.user.role)) {
      return Response.json(
        new ApiResponse(ErrorCodes.FORBIDDEN, { message: "Bạn không có quyền thêm hộ gia đình." }),
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    await sql`ALTER TABLE residents ADD COLUMN IF NOT EXISTS name VARCHAR(255);`;
    const existing = await sql<Array<{ id: string }>>`
      SELECT id FROM households WHERE number = ${number} LIMIT 1
    `;
    if (existing.length > 0) {
      return Response.json(
        new ApiResponse(ErrorCodes.DUPLICATE_OR_CONFLICT, { message: "Số căn hộ này đã tồn tại." }),
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const householdId = generateUUID();
    const residentId = generateUUID();
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO households (id, head_id, number, status)
        VALUES (${householdId}, ${residentId}, ${number}, 'ACTIVE')
      `;
      await tx`
        INSERT INTO residents (id, household_id, name, phone_number, birth_date, relationship)
        VALUES (${residentId}, ${householdId}, ${headName}, ${headPhone || null}, ${headBirthDate}, 'Chủ hộ')
      `;
    });

    return Response.json(
      new ApiResponse(ErrorCodes.SUCCESS, { message: "Đã thêm hộ gia đình thành công.", householdId }),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Create household error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      new ApiResponse(ErrorCodes.SYSTEM_OR_DATABASE_ERROR, { message: "Không thể thêm hộ gia đình. Vui lòng thử lại." }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
