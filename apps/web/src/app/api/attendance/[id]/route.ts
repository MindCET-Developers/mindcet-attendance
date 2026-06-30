import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";

type AttendanceUpdateBody = {
  clock_in?: string | null;
  clock_out?: string | null;
  day_type?: string;
  note?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await getCurrentUser();
    const { id } = await params;
    const body: AttendanceUpdateBody = await request.json();

    // Verify the record belongs to the current user
    const { data: record } = await supabase
      .from("attendance_records")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!record || record.user_id !== user.id) {
      return NextResponse.json(
        { error: "Record not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update the record
    const { data: updated, error } = await supabase
      .from("attendance_records")
      .update({
        clock_in: body.clock_in,
        clock_out: body.clock_out,
        day_type: body.day_type,
        note: body.note,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Failed to update record" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
