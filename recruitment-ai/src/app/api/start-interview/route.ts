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

// Mock questions for testing
const mockQuestions = [
  {
    id: 1,
    question: "Opowiedz mi o sobie i swojej motywacji do pracy w naszej firmie.",
    category: "Wprowadzenie",
    time_limit_seconds: 120
  },
  {
    id: 2,
    question: "Jak radzisz sobie ze stresem i presją czasową w pracy?",
    category: "Zarządzanie stresem",
    time_limit_seconds: 120
  },
  {
    id: 3,
    question: "Opowiedz o sytuacji, kiedy musiałeś/aś współpracować z trudną osobą. Jak to rozwiązałeś/aś?",
    category: "Praca zespołowa",
    time_limit_seconds: 120
  },
  {
    id: 4,
    question: "Jakie są Twoje największe mocne strony i jak wykorzystujesz je w pracy?",
    category: "Samoocena",
    time_limit_seconds: 120
  },
  {
    id: 5,
    question: "Gdzie widzisz siebie za 3-5 lat? Jakie są Twoje cele zawodowe?",
    category: "Cele zawodowe",
    time_limit_seconds: 120
  }
];

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

    console.log('Starting interview for token:', token);

    // For now, return mock questions
    // In production, this would generate personalized questions based on job requirements
    return NextResponse.json({
      success: true,
      questions: mockQuestions,
      message: 'Interview initialized successfully'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error starting interview:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start interview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: corsHeaders });
  }
}