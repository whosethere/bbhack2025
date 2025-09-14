"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Mail, Phone, ExternalLink, Calendar, Award, Brain, FileText, ClipboardList, CheckCircle } from "lucide-react";

interface Application {
  id: string;
  total_score: number | null;
  cv_parsed_data: any;
  status: string;
  applied_at: string;
  job_position_id: string;
  recruitment_task_status?: string | null;
  recruitment_task_score?: number | null;
  recruitment_task_feedback?: string | null;
  manager_interview_status?: string | null;
  candidate_decision?: string | null;
  decision_email_content?: string | null;
  decision_made_at?: string | null;
  cv_file_url?: string | null;
  candidate?: {
    full_name: string;
    email: string;
    phone?: string;
    linkedin_url?: string;
    portfolio_url?: string;
  };
  job_position?: {
    id: string;
    title: string;
    department?: string;
    requirements_must_have: any;
    requirements_nice_to_have: any;
    scoring_formula: any;
  };
  interviews?: Array<{
    id: string;
    status: string;
    ai_insights: any;
    transcript?: string;
    notes?: string;
    created_at: string;
  }>;
}

type RecruitmentStage = 'new_applications' | 'cv_screening' | 'ai_interview' | 'recruitment_task' | 'decision';

function getApplicationStage(application: Application): RecruitmentStage {
  if (!application.total_score) return 'new_applications';
  if (!application.interviews || application.interviews.length === 0) return 'cv_screening';
  if (!application.recruitment_task_status) return 'ai_interview';
  if (application.candidate_decision) return 'decision';
  return 'recruitment_task';
}

function getStageDisplayName(stage: RecruitmentStage): string {
  switch (stage) {
    case 'new_applications': return 'Nowa aplikacja';
    case 'cv_screening': return 'Screening CV';
    case 'ai_interview': return 'AI Interview';
    case 'recruitment_task': return 'Zadanie rekrutacyjne';
    case 'decision': return 'Decyzja';
    default: return 'Nieznany etap';
  }
}

function getStageColor(stage: RecruitmentStage): string {
  switch (stage) {
    case 'new_applications': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'cv_screening': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'ai_interview': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'recruitment_task': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'decision': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const candidateId = params.id as string;

  useEffect(() => {
    fetchApplication();
  }, [candidateId]);

  const fetchApplication = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          total_score,
          cv_parsed_data,
          status,
          applied_at,
          job_position_id,
          recruitment_task_status,
          recruitment_task_score,
          recruitment_task_feedback,
          manager_interview_status,
          candidate_decision,
          decision_email_content,
          decision_made_at,
          cv_file_url,
          candidate:candidates(full_name, email, phone, linkedin_url, portfolio_url),
          job_position:job_positions(id, title, department, requirements_must_have, requirements_nice_to_have, scoring_formula),
          interviews(id, status, ai_insights, transcript, notes, created_at)
        `)
        .eq('id', candidateId)
        .single();

      if (error) throw error;
      setApplication(data);
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateScores = (app: Application) => {
    const technicalScore = app.total_score || 0;

    let softSkillsScore = 0;
    const interview = app.interviews?.[0];
    if (interview?.ai_insights?.overall_assessment) {
      const softSkillsScores = Object.values(interview.ai_insights.overall_assessment);
      softSkillsScore = (softSkillsScores.reduce((sum: number, score: number) => sum + score, 0) / softSkillsScores.length) * 10;
    }

    const combinedScore = (technicalScore * 0.65) + (softSkillsScore * 0.35);

    return {
      technical: technicalScore,
      softSkills: softSkillsScore,
      combined: combinedScore
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Ładowanie profilu kandydata...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Nie znaleziono kandydata</p>
            <Link href="/candidates">
              <Button>← Powrót do listy kandydatów</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scores = calculateScores(application);
  const currentStage = getApplicationStage(application);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Powrót
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{application.candidate?.full_name}</h1>
          <p className="text-gray-600">{application.job_position?.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Informacje podstawowe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{application.candidate?.email}</span>
                </div>
                {application.candidate?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{application.candidate.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>Aplikacja: {new Date(application.applied_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm border ${getStageColor(currentStage)}`}>
                    {getStageDisplayName(currentStage)}
                  </span>
                </div>
              </div>

              {/* External Links */}
              <div className="flex gap-4 mt-4">
                {application.candidate?.linkedin_url && (
                  <a
                    href={application.candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {application.candidate?.portfolio_url && (
                  <a
                    href={application.candidate.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Portfolio
                  </a>
                )}
                {application.cv_file_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(application.cv_file_url, '_blank')}
                  >
                    📄 Pobierz CV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CV Analysis */}
          {application.cv_parsed_data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Analiza CV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Technologies */}
                  {application.cv_parsed_data.lista_technologii?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Technologie</h4>
                      <div className="flex flex-wrap gap-2">
                        {application.cv_parsed_data.lista_technologii.map((tech: string, idx: number) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soft Skills */}
                  {application.cv_parsed_data.lista_umiejetnosci_miekkich?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Umiejętności miękkie</h4>
                      <div className="flex flex-wrap gap-2">
                        {application.cv_parsed_data.lista_umiejetnosci_miekkich.map((skill: string, idx: number) => (
                          <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience & Education */}
                  <div>
                    <h4 className="font-medium mb-2">Doświadczenie</h4>
                    <p className="text-sm text-gray-600">
                      {application.cv_parsed_data.ile_lat_doswiadczenia} lat doświadczenia
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Wykształcenie</h4>
                    <p className="text-sm text-gray-600">
                      {application.cv_parsed_data.wyksztalcenie === 'wyzsze' ? 'Wykształcenie wyższe' : 'Inne wykształcenie'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Interview Results */}
          {application.interviews && application.interviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Wyniki AI Interview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {application.interviews[0].ai_insights?.overall_assessment && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Ocena umiejętności miękkich</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(application.interviews[0].ai_insights.overall_assessment).map(([skill, score]: [string, any]) => (
                        <div key={skill} className="text-center p-3 bg-gray-50 rounded">
                          <div className="text-lg font-bold text-purple-600">{score.toFixed(1)}</div>
                          <div className="text-xs text-gray-600 capitalize">{skill.replace('_', ' ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recruitment Task */}
          {application.recruitment_task_status && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Zadanie rekrutacyjne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      application.recruitment_task_status === 'task_completed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {application.recruitment_task_status === 'task_completed' ? 'Ukończone' : 'Wysłane'}
                    </span>
                  </div>

                  {application.recruitment_task_score !== null && (
                    <div className="flex items-center justify-between">
                      <span>Ocena:</span>
                      <span className="font-bold text-lg">{application.recruitment_task_score}/5</span>
                    </div>
                  )}

                  {application.recruitment_task_feedback && (
                    <div>
                      <h5 className="font-medium mb-2">Feedback:</h5>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {application.recruitment_task_feedback}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decision */}
          {application.candidate_decision && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Decyzja finalna
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      application.candidate_decision === 'offered' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {application.candidate_decision === 'offered' ? '💼 Oferta złożona' : '❌ Kandydatura odrzucona'}
                    </span>
                  </div>

                  {application.decision_made_at && (
                    <div className="flex items-center justify-between">
                      <span>Data decyzji:</span>
                      <span className="text-sm text-gray-600">
                        {new Date(application.decision_made_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {application.decision_email_content && (
                    <div>
                      <h5 className="font-medium mb-2">Wygenerowany email:</h5>
                      <div className="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans">
                          {application.decision_email_content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Scores & Actions */}
        <div className="space-y-6">
          {/* Scores Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Podsumowanie ocen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{scores.combined.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Ocena łączna</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{scores.technical.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">Techniczne (65%)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-600">{scores.softSkills.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">Miękkie (35%)</div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className={`text-center py-2 rounded text-sm font-medium ${
                    scores.combined >= 50 ? 'bg-green-100 text-green-800' :
                    scores.combined >= 20 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {scores.combined >= 50 ? '✅ Rekomendowany' :
                     scores.combined >= 20 ? '⚠️ Częściowo rekomendowany' :
                     '❌ Nie rekomendowany'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Akcje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href={`/dashboard?position=${application.job_position_id}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    📊 Zobacz w kanban
                  </Button>
                </Link>
                <Link href={`/candidates/ranking?job=${application.job_position_id}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    📋 Ranking kandydatów
                  </Button>
                </Link>
                <Link href="/candidates" className="w-full">
                  <Button variant="outline" className="w-full">
                    📝 Wszyscy kandydaci
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Job Position Info */}
          {application.job_position && (
            <Card>
              <CardHeader>
                <CardTitle>Stanowisko</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium">{application.job_position.title}</h4>
                  {application.job_position.department && (
                    <p className="text-sm text-gray-600">{application.job_position.department}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}