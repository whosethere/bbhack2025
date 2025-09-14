import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const video = formData.get("video") as File;
    const interviewToken = formData.get("interview_token") as string;
    const questionId = formData.get("question_id") as string;
    const questionNumber = formData.get("question_number") as string;

    if (!video || !interviewToken || !questionId) {
      return NextResponse.json(
        { error: "Missing required fields: video, interview_token, question_id" },
        { status: 400 }
      );
    }

    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `${interviewToken}_q${questionNumber}_${timestamp}.webm`;

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), "uploads", "interviews");

    try {
      // Create directory if it doesn't exist
      const { mkdirSync } = await import("fs");
      mkdirSync(uploadsDir, { recursive: true });
    } catch (dirError) {
      console.log("Directory already exists or created successfully");
    }

    // Save file
    const bytes = await video.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadsDir, filename);

    await writeFile(filePath, buffer);
    console.log(`Video saved: ${filePath}`);

    // Here you would typically:
    // 1. Store file info in database
    // 2. Queue for transcription (Whisper API)
    // 3. Queue for AI analysis

    // For now, return success with file info
    return NextResponse.json({
      success: true,
      data: {
        filename,
        path: filePath,
        size: buffer.length,
        interview_token: interviewToken,
        question_id: questionId,
        uploaded_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Video upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload video",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Configure max file size for video uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}