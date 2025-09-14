import { NextRequest, NextResponse } from "next/server";

interface ScoringRequest {
  applicationId: string;
  cvData: any;
  jobRequirements: any;
}

interface PythonScoreResponse {
  success: boolean;
  data?: {
    total_score: number;
    qualified_for_interview: boolean;
    ai_insights: any;
    must_have_matches: any[];
    nice_to_have_matches: any[];
    breakdown: any;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { applicationId, cvData, jobRequirements }: ScoringRequest = await request.json();

    if (!applicationId || !cvData || !jobRequirements) {
      return NextResponse.json(
        { error: "Missing required fields: applicationId, cvData, jobRequirements" },
        { status: 400 }
      );
    }

    // Call Python API for scoring
    const pythonApiUrl = process.env.PYTHON_CV_API_URL || "http://localhost:8000";
    const response = await fetch(`${pythonApiUrl}/api/score-candidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cv_data: cvData,
        job_requirements: jobRequirements,
        application_id: applicationId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Python scoring API error:", errorText);
      throw new Error(`Python API failed: ${response.status} - ${errorText}`);
    }

    const pythonResult: PythonScoreResponse = await response.json();

    if (!pythonResult.success) {
      throw new Error(pythonResult.error || "Python API returned error");
    }

    return NextResponse.json({
      success: true,
      data: {
        applicationId,
        score: pythonResult.data?.total_score,
        qualifiedForInterview: pythonResult.data?.qualified_for_interview,
        insights: pythonResult.data?.ai_insights,
        breakdown: pythonResult.data?.breakdown,
        matches: {
          mustHave: pythonResult.data?.must_have_matches,
          niceToHave: pythonResult.data?.nice_to_have_matches
        }
      }
    });

  } catch (error) {
    console.error("Candidate scoring error:", error);
    return NextResponse.json(
      {
        error: "Failed to score candidate",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}