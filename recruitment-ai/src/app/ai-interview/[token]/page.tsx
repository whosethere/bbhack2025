"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface InterviewQuestion {
  id: number;
  question: string;
  time_limit_seconds: number;
  category: string;
}

export default function AIInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeInterview();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isRecording && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRecording) {
      stopRecording();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeLeft, isRecording]);

  const initializeInterview = async () => {
    try {
      // Generate questions for this interview
      const response = await fetch('/api/generate-interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interview_token: token })
      });

      if (!response.ok) throw new Error('Failed to generate questions');

      const data = await response.json();
      setQuestions(data.questions || []);
      setTimeLeft(data.questions?.[0]?.time_limit_seconds || 120);

      // Initialize camera
      await setupCamera();

    } catch (error) {
      console.error('Error initializing interview:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunks.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        uploadRecording();
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingStarted(true);
      setTimeLeft(questions[currentQuestion]?.time_limit_seconds || 120);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  };

  const uploadRecording = async () => {
    if (recordedChunks.current.length === 0) return;

    const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
    const formData = new FormData();

    formData.append('video', blob, `question_${currentQuestion + 1}.webm`);
    formData.append('interview_token', token);
    formData.append('question_id', questions[currentQuestion].id.toString());
    formData.append('question_number', (currentQuestion + 1).toString());

    try {
      const response = await fetch('/api/upload-interview-video', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      console.log('Video uploaded successfully');

      // Move to next question or complete interview
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(questions[currentQuestion + 1]?.time_limit_seconds || 120);
        recordedChunks.current = [];
      } else {
        setInterviewCompleted(true);
        cleanup();
      }

    } catch (error) {
      console.error('Error uploading video:', error);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Przygotowywanie rozmowy...</p>
        </div>
      </div>
    );
  }

  if (interviewCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">🎉 Rozmowa zakończona!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Dziękujemy za udział w rozmowie AI.</p>
            <p className="text-sm text-gray-600">
              Twoje odpowiedzi zostaną przeanalizowane przez nasz system AI.
              Wyniki otrzymasz wkrótce na email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <p>Nie udało się załadować pytań do rozmowy.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Spróbuj ponownie
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold">AI Video Interview</h1>
            <div className="text-lg font-mono">
              Pytanie {currentQuestion + 1} z {questions.length}
            </div>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Twoja kamera</span>
                {isRecording && (
                  <div className="flex items-center text-red-600">
                    <div className="w-3 h-3 bg-red-600 rounded-full mr-2 animate-pulse"></div>
                    REC
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg bg-gray-900"
                style={{ aspectRatio: '16/9' }}
              />

              {/* Timer */}
              {recordingStarted && (
                <div className="mt-4 text-center">
                  <div className="text-3xl font-mono font-bold text-blue-600">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-sm text-gray-600">pozostało</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                {question.category} - Pytanie {currentQuestion + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <p className="text-lg leading-relaxed">
                  {question.question}
                </p>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                Masz <strong>{Math.floor(question.time_limit_seconds / 60)} minut</strong> na odpowiedź.
              </div>

              {!recordingStarted ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Instrukcje:</h3>
                    <ul className="text-sm space-y-1">
                      <li>• Upewnij się, że masz dobrą jakość audio i video</li>
                      <li>• Mów jasno i wyraźnie</li>
                      <li>• Nagrywanie rozpocznie się po kliknięciu przycisku</li>
                      <li>• Możesz używać gestów i mimiki</li>
                    </ul>
                  </div>

                  <Button
                    onClick={startRecording}
                    className="w-full bg-red-600 hover:bg-red-700"
                    size="lg"
                  >
                    🎥 Rozpocznij nagrywanie odpowiedzi
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {isRecording ? (
                    <Button
                      onClick={stopRecording}
                      className="w-full bg-gray-600 hover:bg-gray-700"
                      size="lg"
                    >
                      ⏹️ Zakończ nagrywanie
                    </Button>
                  ) : (
                    <div className="text-center text-gray-600">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      Przetwarzanie nagrania...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}