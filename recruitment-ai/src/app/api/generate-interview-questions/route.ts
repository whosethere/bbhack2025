import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { interview_token } = await request.json();

    if (!interview_token) {
      return NextResponse.json(
        { error: "Interview token is required" },
        { status: 400 }
      );
    }

    // Call Python API for questions generation
    const pythonApiUrl = process.env.PYTHON_CV_API_URL || "http://localhost:8000";
    const response = await fetch(`${pythonApiUrl}/api/generate-interview-questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        interview_token,
        job_position: "General", // Could be dynamic based on application
        candidate_profile: null
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Python questions API error:", errorText);
      throw new Error(`Python API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Python API returned error");
    }

    return NextResponse.json({
      success: true,
      questions: result.questions
    });

  } catch (error) {
    console.error("Questions generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate interview questions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}