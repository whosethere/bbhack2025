"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Interview {
  id: string;
  status: string;
  ai_insights: any;
  transcript: string | null;
  notes: string | null;
  created_at: string;
}

interface Application {
  id: string;
  total_score: number | null;
  ai_analysis: any;
  cv_parsed_data: any;
  status: string;
  applied_at: string;
  recruitment_task_status?: string;
  recruitment_task_score?: number;
  recruitment_task_feedback?: string;
  candidate_decision?: string;
  decision_email_content?: string;
  decision_made_at?: string;
  candidate: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  job_position: {
    title: string;
    requirements_must_have: any[];
    requirements_nice_to_have: any[];
    scoring_formula: any;
  };
  interviews: Interview[];
}

interface ScoreResult {
  applicationId: string;
  score: number;
  qualifiedForInterview: boolean;
  insights: any;
  breakdown: any;
}

interface JobPosition {
  id: string;
  title: string;
}

export default function CandidateRankingPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const calculateCombinedScore = (app: Application) => {
    const technicalScore = app.total_score || 0; // Ocena techniczna z CV (0-100)

    // Użyj tego samego interview co getInterviewStatus (ostatni interview)
    const interview = app.interviews && app.interviews.length > 0
      ? app.interviews[app.interviews.length - 1]
      : null;

    let softSkillsScore = 0;
    if (interview?.ai_insights?.overall_assessment) {
      const softSkillsScores = Object.values(interview.ai_insights.overall_assessment);
      softSkillsScore = (softSkillsScores.reduce((sum: number, score: number) => sum + score, 0) / softSkillsScores.length) * 10; // Konwertuj z 0-10 na 0-100
    }

    // Kombinowana ocena: 65% techniczna + 35% miękka
    const combinedScore = (technicalScore * 0.65) + (softSkillsScore * 0.35);

    return {
      technical: technicalScore,
      softSkills: softSkillsScore,
      combined: combinedScore
    };
  };

  useEffect(() => {
    fetchApplications();
    fetchJobPositions();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [selectedJobId]);

  const fetchJobPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_positions')
        .select('id, title')
        .eq('status', 'published');

      if (error) throw error;
      setJobPositions(data || []);
    } catch (error) {
      console.error('Error fetching job positions:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      let query = supabase
        .from('applications')
        .select(`
          id,
          total_score,
          ai_analysis,
          cv_parsed_data,
          status,
          applied_at,
          job_position_id,
          recruitment_task_status,
          recruitment_task_score,
          recruitment_task_feedback,
          candidate_decision,
          decision_email_content,
          decision_made_at,
          candidate:candidates(full_name, email, phone),
          job_position:job_positions(id, title, requirements_must_have, requirements_nice_to_have, scoring_formula),
          interviews(id, status, ai_insights, transcript, notes, created_at)
        `);

      // Filter by job position if selected
      if (selectedJobId !== "all") {
        query = query.eq('job_position_id', selectedJobId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort by technical score (simple)
      const sortedData = (data || []).sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

      setApplications(sortedData);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const scoreApplication = async (app: Application) => {
    if (!app.cv_parsed_data || !app.job_position) return;

    setScoring(app.id);
    try {
      const response = await fetch('/api/score-candidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: app.id,
          cvData: app.cv_parsed_data,
          jobRequirements: app.job_position
        }),
      });

      if (!response.ok) throw new Error('Scoring failed');

      const result: { success: boolean; data: ScoreResult } = await response.json();

      if (result.success) {
        // Update application in Supabase
        const { error } = await supabase
          .from('applications')
          .update({
            total_score: result.data.score,
            ai_analysis: result.data
          })
          .eq('id', app.id);

        if (error) throw error;

        // Note: AI interview record will be created when HR clicks "AI Interview" button

        // Refresh data
        await fetchApplications();
      }
    } catch (error) {
      console.error('Error scoring application:', error);
    } finally {
      setScoring(null);
    }
  };

  const deleteCandidate = async (app: Application) => {
    if (!app.candidate?.email) return;

    setDeleting(app.id);
    try {
      // First delete the application
      const { error: appError } = await supabase
        .from('applications')
        .delete()
        .eq('id', app.id);

      if (appError) throw appError;

      // Then delete the candidate
      const { error: candidateError } = await supabase
        .from('candidates')
        .delete()
        .eq('email', app.candidate.email);

      if (candidateError) throw candidateError;

      // Refresh data
      await fetchApplications();

    } catch (error) {
      console.error('Error deleting candidate:', error);
      alert('Błąd podczas usuwania kandydata');
    } finally {
      setDeleting(null);
    }
  };

  const sendRecruitmentTask = async (app: Application) => {
    try {
      // Mock sending recruitment task
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          recruitment_task_status: 'task_sent'
        })
        .eq('id', app.id);

      if (updateError) throw updateError;

      // Refresh data
      await fetchApplications();

      alert(`📝 Zadanie rekrutacyjne wysłane do ${app.candidate?.full_name}!\n\nZadanie: "Napisz zapytanie SQL aby wybrać wszystkie rekordy z tabeli orders"`);

    } catch (error) {
      console.error('Error sending recruitment task:', error);
      alert('Błąd podczas wysyłania zadania rekrutacyjnego');
    }
  };

  const evaluateTaskSolution = async (app: Application, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('application_id', app.id);

      console.log('Uploading task solution:', file.name);

      // Call Python API
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERVIEW_API_URL || 'http://localhost:8000'}/api/evaluate-recruitment-task`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Update application with task results
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            recruitment_task_status: 'task_completed',
            recruitment_task_score: result.evaluation.score,
            recruitment_task_feedback: result.evaluation.feedback
          })
          .eq('id', app.id);

        if (updateError) throw updateError;

        // Refresh data
        await fetchApplications();

        alert(`✅ Zadanie ocenione!\n\nOcena: ${result.evaluation.score}/5\nKomentarz: ${result.evaluation.feedback}`);

      } else {
        throw new Error(result.error || 'Evaluation failed');
      }

    } catch (error) {
      console.error('Error evaluating task solution:', error);
      alert('Błąd podczas oceny zadania: ' + (error as Error).message);
    }
  };

  const makeCandidateDecision = async (app: Application, decisionType: 'offer' | 'rejection') => {
    try {
      const formData = new FormData();
      formData.append('application_id', app.id);
      formData.append('decision_type', decisionType);

      console.log('Making candidate decision:', decisionType, app.id);

      // Call Python API to generate email
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERVIEW_API_URL || 'http://localhost:8000'}/api/generate-candidate-summary`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Update application with decision
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            candidate_decision: decisionType === 'offer' ? 'offered' : 'rejected',
            decision_email_content: result.email_content,
            decision_made_at: new Date().toISOString()
          })
          .eq('id', app.id);

        if (updateError) throw updateError;

        // Refresh data
        await fetchApplications();

        const actionText = decisionType === 'offer' ? 'Oferta złożona!' : 'Kandydatura odrzucona!';
        alert(`✅ ${actionText}\n\nWygenerowany email:\n\n${result.email_content.substring(0, 200)}...`);

      } else {
        throw new Error(result.error || 'Decision generation failed');
      }

    } catch (error) {
      console.error('Error making candidate decision:', error);
      alert('Błąd podczas podejmowania decyzji: ' + (error as Error).message);
    }
  };

  const startAIInterview = async (app: Application) => {
    try {
      // Generate unique interview token
      const interviewToken = `interview_${app.id}_${Date.now()}`;

      // Save interview record to Supabase
      const { error: interviewError } = await supabase
        .from('interviews')
        .insert({
          application_id: app.id,
          type: 'ai_video',
          status: 'scheduled',
          meeting_link: `http://localhost:8000/ai-interview/${interviewToken}`,
          ai_insights: {
            interview_token: interviewToken,
            started_at: new Date().toISOString()
          }
        });

      if (interviewError) {
        console.error('Error creating interview record:', interviewError);
        alert('Błąd podczas tworzenia rozmowy AI');
        return;
      }

      // Open AI Interview in new tab (VPS deployment)
      const vpsUrl = process.env.NEXT_PUBLIC_INTERVIEW_API_URL || 'http://localhost:8000';
      const interviewUrl = `${vpsUrl}/ai-interview/${interviewToken}?candidate_id=${app.id}&job_title=${encodeURIComponent(app.job_position?.title || 'General')}`;
      window.open(interviewUrl, '_blank');

    } catch (error) {
      console.error('Error starting AI interview:', error);
      alert('Błąd podczas uruchamiania rozmowy AI');
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-gray-400";
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    if (score >= 25) return "text-orange-600";
    return "text-red-600";
  };

  const getQualificationStatus = (score: number | null) => {
    if (!score) return { status: "Nie oceniono", color: "bg-gray-100" };
    if (score >= 25) return { status: "Kwalifikuje się do AI interview", color: "bg-green-100 text-green-800" };
    return { status: "Nie kwalifikuje się", color: "bg-red-100 text-red-800" };
  };

  const getInterviewStatus = (interviews: Interview[]) => {
    if (!interviews || interviews.length === 0) {
      return { status: "Brak rozmowy", color: "bg-gray-100 text-gray-800", hasData: false };
    }

    const latestInterview = interviews[interviews.length - 1];
    switch (latestInterview.status) {
      case 'completed':
        return { status: "Zakończona", color: "bg-green-100 text-green-800", hasData: true, interview: latestInterview };
      case 'scheduled':
        return { status: "Zaplanowana", color: "bg-blue-100 text-blue-800", hasData: false };
      case 'in_progress':
        return { status: "W trakcie", color: "bg-yellow-100 text-yellow-800", hasData: false };
      default:
        return { status: "Nieznany status", color: "bg-gray-100 text-gray-800", hasData: false };
    }
  };

  const getInterviewScore = (interview: Interview) => {
    if (!interview?.ai_insights?.overall_assessment) return null;
    const scores = Object.values(interview.ai_insights.overall_assessment);
    return scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
  };

  const toggleCardExpansion = (appId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(appId)) {
        newSet.delete(appId);
      } else {
        newSet.add(appId);
      }
      return newSet;
    });
  };

  const getTaskStatus = (app: Application) => {
    const scores = calculateCombinedScore(app);
    const isEligible = scores.combined >= 50;
    const taskStatus = app.recruitment_task_status;

    if (!isEligible) {
      return { canSend: false, status: null };
    }

    if (!taskStatus) {
      return { canSend: true, status: 'not_sent' };
    }

    switch (taskStatus) {
      case 'task_sent':
        return { canSend: false, status: 'waiting_for_solution' };
      case 'task_completed':
        return { canSend: false, status: 'completed' };
      default:
        return { canSend: true, status: 'not_sent' };
    }
  };

  const getRecommendationBadge = (app: Application) => {
    const scores = calculateCombinedScore(app);
    const combinedScore = scores.combined;

    // Prosta logika 3-poziomowa oparta na kombinowanej ocenie (0-100)
    if (combinedScore <= 20) {
      return { text: "❌ Nie rekomendowany", color: "bg-red-500 text-white" };
    } else if (combinedScore <= 50) {
      return { text: "🤔 Semi-rekomendowany", color: "bg-yellow-500 text-white" };
    } else {
      return { text: "✅ Rekomendowany", color: "bg-green-500 text-white" };
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Ranking Kandydatów</h1>
        <p className="text-gray-600">
          Kandydaci posortowani według wyniku AI. Próg kwalifikacji: 20 punktów (liberalny).
        </p>

        {/* Job Position Filter */}
        <div className="mt-4 flex items-center gap-4">
          <div className="w-64">
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz ofertę pracy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie oferty</SelectItem>
                {jobPositions.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-gray-500">
            Znaleziono {applications.length} kandydatów
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {applications.map((app, index) => {
          const qualification = getQualificationStatus(app.total_score);
          const interviewStatus = getInterviewStatus(app.interviews);
          const recommendationBadge = getRecommendationBadge(app);
          const scores = calculateCombinedScore(app);
          const taskStatus = getTaskStatus(app);
          const isExpanded = expandedCards.has(app.id);

          return (
            <Card key={app.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      #{index + 1} {app.candidate?.full_name || "Nieznany kandydat"}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {app.job_position?.title} • {app.candidate?.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(scores.combined)}`}>
                      {scores.combined ? `${scores.combined.toFixed(1)}` : "—"}
                    </div>
                    <div className="text-sm text-gray-500">ocena łączna</div>
                    <div className="text-xs text-gray-400 mt-1">
                      T: {scores.technical.toFixed(1)} | M: {scores.softSkills.toFixed(1)}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${qualification.color}`}>
                        {qualification.status}
                      </span>

                      {/* AI Interview Status */}
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${interviewStatus.color}`}>
                        📹 {interviewStatus.status}
                      </span>

                      {/* Recommendation Badge */}
                      {recommendationBadge && interviewStatus.hasData && (
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${recommendationBadge.color}`}>
                          {recommendationBadge.text}
                        </span>
                      )}

                      {interviewStatus.hasData && interviewStatus.interview && (
                        <span className="text-xs text-gray-600">
                          Wynik: {getInterviewScore(interviewStatus.interview)?.toFixed(1) || 'N/A'}/10
                        </span>
                      )}
                    </div>

                    {/* AI Interview Results */}
                    {interviewStatus.hasData && interviewStatus.interview?.ai_insights && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Wyniki rozmowy AI:</p>
                        {interviewStatus.interview.ai_insights.overall_assessment && (
                          <div className="text-xs text-gray-600 mt-1">
                            {Object.entries(interviewStatus.interview.ai_insights.overall_assessment).map(([skill, score]: [string, any]) => (
                              <div key={skill} className="flex justify-between">
                                <span>{skill}:</span>
                                <span className="font-medium">{score}/10</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {interviewStatus.interview.ai_insights.detailed_results?.[0]?.analysis?.strengths && (
                          <div className="mt-1">
                            <p className="text-xs font-medium text-gray-700">Mocne strony (rozmowa):</p>
                            <ul className="text-xs text-gray-600 list-disc list-inside ml-2">
                              {interviewStatus.interview.ai_insights.detailed_results[0].analysis.strengths.slice(0, 3).map((strength: string, i: number) => (
                                <li key={i}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {app.ai_analysis?.insights?.strengths && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Mocne strony (CV):</p>
                        <ul className="text-xs text-gray-600 list-disc list-inside">
                          {app.ai_analysis.insights.strengths.map((strength: string, i: number) => (
                            <li key={i}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex gap-2">
                    {/* Score/Re-score Button */}
                    {app.cv_parsed_data && (
                      <Button
                        onClick={() => scoreApplication(app)}
                        disabled={scoring === app.id}
                        size="sm"
                        variant={app.total_score ? "outline" : "default"}
                      >
                        {scoring === app.id
                          ? "Ocenianie..."
                          : app.total_score
                            ? "Oceń ponownie"
                            : "Oceń kandydata"}
                      </Button>
                    )}

                    {/* Expand/Collapse Interview Details Button */}
                    {interviewStatus.hasData && interviewStatus.interview && (
                      <Button
                        onClick={() => toggleCardExpansion(app.id)}
                        size="sm"
                        variant="outline"
                        className="border-green-200 text-green-700 hover:bg-green-50"
                      >
                        {isExpanded ? "🔼 Zwiń szczegóły" : "🔽 Pokaż szczegóły"}
                      </Button>
                    )}

                    {/* Watch Interview Videos Button - now expands details */}
                    {interviewStatus.hasData && interviewStatus.interview?.ai_insights?.video_files?.length > 0 && (
                      <Button
                        onClick={() => toggleCardExpansion(app.id)}
                        size="sm"
                        variant="outline"
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        🎥 Nagrania ({interviewStatus.interview.ai_insights.video_files.length})
                      </Button>
                    )}

                    {/* AI Interview Button - show if qualified */}
                    {app.total_score && app.total_score >= 20 && !interviewStatus.hasData && (
                      <Button
                        onClick={() => startAIInterview(app)}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        📹 AI Interview
                      </Button>
                    )}

                    {/* Recruitment Task Button */}
                    {taskStatus.canSend && (
                      <Button
                        onClick={() => sendRecruitmentTask(app)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        📝 Wyślij zadanie
                      </Button>
                    )}

                    {/* Task Status Display */}
                    {taskStatus.status === 'waiting_for_solution' && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                        📝 Wysłane, czekamy na odpowiedź
                      </span>
                    )}
                    {taskStatus.status === 'completed' && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                        📝 Zadanie ocenione: {app.recruitment_task_score || 0}/5
                      </span>
                    )}

                    {/* Decision Buttons - show if no decision made yet */}
                    {!app.candidate_decision && (
                      <>
                        <Button
                          onClick={() => {
                            if (confirm(`Czy na pewno chcesz złożyć ofertę kandydatowi ${app.candidate?.full_name}?\n\nZostanie wygenerowany profesjonalny email z ofertą współpracy.`)) {
                              makeCandidateDecision(app, 'offer');
                            }
                          }}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          💼 Złóż ofertę
                        </Button>

                        <Button
                          onClick={() => {
                            if (confirm(`Czy na pewno chcesz odrzucić kandydaturę ${app.candidate?.full_name}?\n\nZostanie wygenerowany profesjonalny email z konstruktywnym feedbackiem.`)) {
                              makeCandidateDecision(app, 'rejection');
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          ❌ Odrzuć kandydaturę
                        </Button>
                      </>
                    )}

                    {/* Decision Status Display */}
                    {app.candidate_decision === 'offered' && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                        💼 Oferta złożona
                      </span>
                    )}
                    {app.candidate_decision === 'rejected' && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                        ❌ Kandydatura odrzucona
                      </span>
                    )}

                    {/* Delete Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting === app.id}
                      onClick={() => {
                        if (confirm(`Czy na pewno chcesz usunąć kandydata ${app.candidate?.full_name}? Ta akcja jest nieodwracalna.`)) {
                          deleteCandidate(app);
                        }
                      }}
                    >
                      {deleting === app.id ? "Usuwanie..." : "🗑️ Usuń"}
                    </Button>
                  </div>
                </div>

                {/* Expandable Interview Details Section */}
                {isExpanded && interviewStatus.hasData && interviewStatus.interview && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column - Interview Results */}
                      <div>
                        <h4 className="font-semibold text-sm mb-2">📊 Wyniki oceny kandydata</h4>

                        {/* Combined Scoring System */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <div className="text-lg font-bold text-gray-700">{scores.technical.toFixed(1)}</div>
                              <div className="text-xs text-gray-500">Techniczne (65%)</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-blue-600">{scores.softSkills.toFixed(1)}</div>
                              <div className="text-xs text-gray-500">Miękkie (35%)</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-green-600">{scores.combined.toFixed(1)}</div>
                              <div className="text-xs text-gray-500">ŁĄCZNIE</div>
                            </div>
                          </div>
                        </div>

                        {/* Overall Score */}
                        <div className="mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-blue-600">
                              {getInterviewScore(interviewStatus.interview)?.toFixed(1) || 'N/A'}
                            </span>
                            <span className="text-sm text-gray-500">/ 10</span>
                          </div>
                        </div>

                        {/* Soft Skills Assessment */}
                        <div className="mb-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-1">Umiejętności miękkie:</h5>
                          <div className="space-y-1">
                            {Object.entries(interviewStatus.interview.ai_insights.overall_assessment || {}).map(([skill, score]: [string, any]) => (
                              <div key={skill} className="flex justify-between items-center">
                                <span className="text-xs text-gray-600 capitalize">{skill.replace(/_/g, ' ')}:</span>
                                <div className="flex items-center gap-1">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{ width: `${(score / 10) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium w-8 text-right">{score}/10</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recommendation */}
                        {interviewStatus.interview.ai_insights.detailed_results?.[0]?.analysis?.recommendation && (
                          <div className="mb-3 p-2 bg-gray-50 rounded">
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Rekomendacja:</h5>
                            <p className="text-xs text-gray-600">
                              {interviewStatus.interview.ai_insights.detailed_results[0].analysis.recommendation}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Column - Strengths and Development Areas */}
                      <div>
                        {/* Strengths */}
                        {interviewStatus.interview.ai_insights.detailed_results?.[0]?.analysis?.strengths && (
                          <div className="mb-3">
                            <h5 className="text-xs font-medium text-green-700 mb-1">🌟 Mocne strony:</h5>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {interviewStatus.interview.ai_insights.detailed_results[0].analysis.strengths.map((strength: string, i: number) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-500 mr-1">•</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Areas for Development */}
                        {interviewStatus.interview.ai_insights.detailed_results?.[0]?.analysis?.areas_for_development && (
                          <div className="mb-3">
                            <h5 className="text-xs font-medium text-orange-700 mb-1">📈 Obszary do rozwoju:</h5>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {interviewStatus.interview.ai_insights.detailed_results[0].analysis.areas_for_development.map((area: string, i: number) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-orange-500 mr-1">•</span>
                                  <span>{area}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Summary */}
                        {interviewStatus.interview.ai_insights.detailed_results?.[0]?.analysis?.summary && (
                          <div className="p-2 bg-blue-50 rounded">
                            <h5 className="text-xs font-medium text-blue-700 mb-1">💬 Podsumowanie:</h5>
                            <p className="text-xs text-gray-700">
                              {interviewStatus.interview.ai_insights.detailed_results[0].analysis.summary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Transcript Section */}
                    {interviewStatus.interview.transcript && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <h5 className="text-xs font-medium text-gray-700 mb-2">📝 Transkrypcja rozmowy:</h5>
                        <p className="text-xs text-gray-600 whitespace-pre-line max-h-40 overflow-y-auto">
                          {interviewStatus.interview.transcript}
                        </p>
                      </div>
                    )}

                    {/* Video Files Section */}
                    {interviewStatus.interview?.ai_insights?.video_files?.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded">
                        <h5 className="text-xs font-medium text-blue-700 mb-2">🎥 Nagrania rozmowy AI ({interviewStatus.interview.ai_insights.video_files.length} pytań):</h5>
                        <div className="space-y-2">
                          {interviewStatus.interview.ai_insights.video_files.map((video: any, index: number) => {
                            const vpsUrl = process.env.NEXT_PUBLIC_INTERVIEW_API_URL || 'http://localhost:8000';
                            const videoUrl = `${vpsUrl}${video.video_url}`;

                            return (
                              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                <span className="text-xs text-gray-700">
                                  📹 Pytanie {video.question_id}
                                </span>
                                <a
                                  href={videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  Otwórz nagranie →
                                </a>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          💡 Kliknij "Otwórz nagranie" aby obejrzeć wideo w nowej karcie
                        </div>
                      </div>
                    )}

                    {/* Recruitment Task Section */}
                    {taskStatus.status === 'waiting_for_solution' && (
                      <div className="mt-4 p-3 bg-orange-50 rounded">
                        <h5 className="text-xs font-medium text-orange-700 mb-2">📝 Zadanie rekrutacyjne:</h5>
                        <div className="mb-3 p-2 bg-white rounded border">
                          <p className="text-xs text-gray-700 font-medium">
                            Zadanie SQL: "Napisz zapytanie SQL aby wybrać wszystkie rekordy z tabeli orders"
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-orange-600">
                            🔄 Oczekujemy na przesłanie rozwiązania przez kandydata
                          </p>
                          <div className="mt-2">
                            <input
                              type="file"
                              accept=".sql,.txt,.md"
                              className="text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (confirm(`Czy na pewno chcesz przesłać rozwiązanie?\n\nPlik: ${file.name}\n\nPo przesłaniu nastąpi automatyczna ocena przez AI.`)) {
                                    evaluateTaskSolution(app, file);
                                  }
                                }
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Akceptowane formaty: .sql, .txt, .md
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Task Results Section */}
                    {taskStatus.status === 'completed' && (
                      <div className="mt-4 p-3 bg-green-50 rounded">
                        <h5 className="text-xs font-medium text-green-700 mb-2">📝 Wyniki zadania rekrutacyjnego:</h5>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-xs text-gray-700">Ocena zadania:</span>
                            <span className="text-sm font-bold text-green-600">
                              {app.recruitment_task_score || 0}/5
                            </span>
                          </div>
                          {app.recruitment_task_feedback && (
                            <div className="p-2 bg-white rounded border">
                              <p className="text-xs text-gray-700">
                                <strong>Feedback AI:</strong> {app.recruitment_task_feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Candidate Decision Section */}
                    {app.candidate_decision && app.decision_email_content && (
                      <div className={`mt-4 p-3 rounded ${app.candidate_decision === 'offered' ? 'bg-blue-50' : 'bg-red-50'}`}>
                        <h5 className={`text-xs font-medium mb-2 ${app.candidate_decision === 'offered' ? 'text-blue-700' : 'text-red-700'}`}>
                          {app.candidate_decision === 'offered' ? '💼 Decyzja: Oferta złożona' : '❌ Decyzja: Kandydatura odrzucona'}
                        </h5>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-xs text-gray-700">Status:</span>
                            <span className={`text-xs font-bold ${app.candidate_decision === 'offered' ? 'text-blue-600' : 'text-red-600'}`}>
                              {app.candidate_decision === 'offered' ? '💼 Oferta współpracy' : '❌ Kandydatura odrzucona'}
                            </span>
                          </div>

                          {app.decision_made_at && (
                            <div className="flex items-center justify-between bg-white p-2 rounded border">
                              <span className="text-xs text-gray-700">Data decyzji:</span>
                              <span className="text-xs text-gray-600">
                                {new Date(app.decision_made_at).toLocaleDateString('pl-PL')} {new Date(app.decision_made_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          <div className="p-3 bg-white rounded border">
                            <h6 className="text-xs font-medium text-gray-700 mb-2">📧 Wygenerowany email:</h6>
                            <div className="text-xs text-gray-700 whitespace-pre-line max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                              {app.decision_email_content}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(app.decision_email_content || '')}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              📋 Skopiuj email do schowka
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Details for Candidates WITHOUT Interview */}
                {isExpanded && !interviewStatus.hasData && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-sm mb-2">📊 Wyniki oceny kandydata</h4>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div>
                          <div className="text-lg font-bold text-gray-700">{scores.technical.toFixed(1)}</div>
                          <div className="text-xs text-gray-500">Techniczne (CV)</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-orange-500">Brak</div>
                          <div className="text-xs text-gray-500">Miękkie (Interview)</div>
                        </div>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-sm text-gray-600">
                          ℹ️ Ocena kombinowana będzie dostępna po przeprowadzeniu rozmowy AI
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {applications.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Brak aplikacji do wyświetlenia
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}