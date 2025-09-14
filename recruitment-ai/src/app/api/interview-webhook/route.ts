import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface VideoFile {
  question_id: string;
  filename: string;
  video_url: string;
}

interface InterviewWebhookData {
  token: string;
  completed_at: number;
  questions_analyzed: number;
  overall_assessment: {
    [skill: string]: number;
  };
  detailed_results: Array<{
    transcript: string;
    analysis: {
      overall_score: number;
      communication_clarity: {
        score: number;
        comments: string;
      };
      content_relevance: {
        score: number;
        comments: string;
      };
      soft_skills_assessment: {
        [skill: string]: number;
      };
      strengths: string[];
      areas_for_development: string[];
      summary: string;
      recommendation: string;
    };
  }>;
  video_files?: VideoFile[];
}

export async function POST(request: NextRequest) {
  try {
    const webhookData: InterviewWebhookData = await request.json();

    if (!webhookData.token) {
      return NextResponse.json(
        { error: "Missing interview token" },
        { status: 400 }
      );
    }

    console.log("Received interview webhook for token:", webhookData.token);
    console.log("Questions analyzed:", webhookData.questions_analyzed);
    console.log("Overall assessment:", webhookData.overall_assessment);

    // Try to find the interview record by token in ai_insights
    let { data: interviews, error: searchError } = await supabase
      .from('interviews')
      .select('*')
      .contains('ai_insights', { interview_token: webhookData.token });

    if (searchError) {
      console.error("Error searching for interview with contains:", searchError);
      // Try alternative search method
      const { data: allInterviews, error: allError } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!allError && allInterviews) {
        // Look for interview with matching token in ai_insights
        interviews = allInterviews.filter(i =>
          i.ai_insights?.interview_token === webhookData.token
        );
        console.log(`Found ${interviews.length} interviews with matching token from ${allInterviews.length} recent interviews`);
      }
    }

    if (!interviews || interviews.length === 0) {
      console.error("Interview not found for token:", webhookData.token);

      // Try to extract application_id from token (format: interview_{app_id}_{timestamp})
      const tokenParts = webhookData.token.split('_');
      if (tokenParts.length >= 3 && tokenParts[0] === 'interview') {
        const applicationId = tokenParts[1];
        console.log("Trying to find interview by application_id:", applicationId);

        // Try to find by application_id
        const { data: appInterviews, error: appError } = await supabase
          .from('interviews')
          .select('*')
          .eq('application_id', applicationId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!appError && appInterviews && appInterviews.length > 0) {
          interviews = appInterviews;
          console.log("Found interview by application_id!");
        }
      }

      if (!interviews || interviews.length === 0) {
        return NextResponse.json(
          { error: "Interview not found", token: webhookData.token },
          { status: 404 }
        );
      }
    }

    const interview = interviews[0];
    console.log("Processing interview ID:", interview.id, "Status:", interview.status);

    // Prepare AI insights with results
    const aiInsights = {
      ...interview.ai_insights,
      completed_at: new Date(webhookData.completed_at * 1000).toISOString(),
      questions_analyzed: webhookData.questions_analyzed,
      overall_assessment: webhookData.overall_assessment,
      detailed_results: webhookData.detailed_results,
      video_files: webhookData.video_files || [],
      status: 'completed'
    };

    // Calculate overall interview score (average of soft skills)
    const overallScores = Object.values(webhookData.overall_assessment);
    const overallScore = overallScores.length > 0
      ? overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length
      : 0;

    // Update interview record
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'completed',
        ai_insights: aiInsights,
        transcript: webhookData.detailed_results.map(r => r.transcript).join('\n\n'),
        notes: webhookData.detailed_results[0]?.analysis?.summary || 'AI Interview completed'
      })
      .eq('id', interview.id);

    if (updateError) {
      console.error("Error updating interview:", updateError);
      throw updateError;
    }

    console.log(`Interview ${interview.id} updated successfully with status: completed`);

    // Update application with interview insights
    if (interview.application_id) {
      const { error: appUpdateError } = await supabase
        .from('applications')
        .update({
          ai_analysis: {
            ...(interview.ai_analysis || {}),
            interview_results: {
              overall_score: Math.round(overallScore * 10) / 10,
              soft_skills: webhookData.overall_assessment,
              recommendation: webhookData.detailed_results[0]?.analysis?.recommendation || 'consider',
              completed_at: aiInsights.completed_at
            }
          }
        })
        .eq('id', interview.application_id);

      if (appUpdateError) {
        console.error("Error updating application:", appUpdateError);
      }
    }

    console.log(`Interview ${webhookData.token} processed successfully`);

    return NextResponse.json({
      success: true,
      message: "Interview results processed successfully",
      interview_id: interview.id,
      overall_score: overallScore
    });

  } catch (error) {
    console.error("Interview webhook error:", error);
    return NextResponse.json(
      {
        error: "Failed to process interview results",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}