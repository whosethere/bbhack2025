import { NextRequest, NextResponse } from 'next/server';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Missing interview token'
      }, { status: 400 });
    }

    console.log('Completing interview for token:', token);

    // Mock analysis results
    const mockResults = {
      token,
      completed_at: Math.floor(Date.now() / 1000),
      questions_analyzed: 5,
      overall_assessment: {
        communication: 8.2,
        problem_solving: 7.5,
        teamwork: 8.0,
        adaptability: 7.8,
        leadership_potential: 7.2
      },
      detailed_results: [
        {
          transcript: "Przykładowa transkrypcja odpowiedzi...",
          analysis: {
            overall_score: 78,
            communication_clarity: {
              score: 8.2,
              comments: "Kandydat wyraża się jasno i zrozumiale."
            },
            content_relevance: {
              score: 7.5,
              comments: "Odpowiedzi są na temat i merytorycznie poprawne."
            },
            soft_skills_assessment: {
              communication: 8.2,
              problem_solving: 7.5,
              teamwork: 8.0,
              adaptability: 7.8,
              leadership_potential: 7.2
            },
            strengths: [
              "Doskonała komunikacja",
              "Pozytywne nastawienie",
              "Umiejętność pracy w zespole"
            ],
            areas_for_development: [
              "Większa asertywność",
              "Rozwijanie umiejętności przywódczych"
            ],
            summary: "Kandydat wykazuje mocne umiejętności interpersonalne i pozytywne nastawienie do pracy.",
            recommendation: "recommend"
          }
        }
      ]
    };

    // Send webhook to interview-webhook endpoint
    try {
      const webhookUrl = 'http://localhost:3000/api/interview-webhook';
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockResults)
      });

      if (webhookResponse.ok) {
        console.log('Successfully sent webhook for interview:', token);
      } else {
        console.warn('Webhook failed with status:', webhookResponse.status);
      }
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
    }

    return NextResponse.json({
      success: true,
      message: 'Interview completed successfully',
      results: mockResults
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error completing interview:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete interview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: corsHeaders });
  }
}