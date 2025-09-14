"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";

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
  candidates: {
    full_name: string;
    email: string;
    phone?: string;
    linkedin_url?: string;
    portfolio_url?: string;
  };
  job_positions: {
    id: string;
    title: string;
    department?: string;
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

// Function to determine application stage based on data
function getApplicationStage(application: Application): RecruitmentStage {
  // Stage 1: New application (has CV, no score)
  if (!application.total_score) {
    return 'new_applications';
  }

  // Stage 2: CV screening (has score, no interviews)
  if (!application.interviews || application.interviews.length === 0) {
    return 'cv_screening';
  }

  // Stage 3: AI interview (has interviews, no recruitment task)
  if (!application.recruitment_task_status) {
    return 'ai_interview';
  }

  // Stage 6: Decision (has final decision - skip manager interview since it's mock)
  if (application.candidate_decision) {
    return 'decision';
  }

  // Stage 4: Recruitment task (has task status, but no final decision yet)
  // This includes both task_sent and task_completed since manager interview is mock
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
    case 'new_applications': return 'bg-blue-100 text-blue-800';
    case 'cv_screening': return 'bg-yellow-100 text-yellow-800';
    case 'ai_interview': return 'bg-purple-100 text-purple-800';
    case 'recruitment_task': return 'bg-orange-100 text-orange-800';
    case 'decision': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function CandidatesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
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
          candidates(full_name, email, phone, linkedin_url, portfolio_url),
          job_positions(id, title, department),
          interviews(id, status, ai_insights, transcript, notes, created_at)
        `)
        .order("applied_at", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Wszyscy kandydaci</h1>
        <Link href="/positions">
          <Button>➕ Dodaj kandydata do stanowiska</Button>
        </Link>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Brak kandydatów w systemie</p>
            <Link href="/positions">
              <Button>Dodaj pierwszego kandydata</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{app.candidates.full_name}</CardTitle>
                    <p className="text-sm text-gray-500">{app.candidates.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.total_score && (
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        app.total_score >= 80 ? "bg-green-100 text-green-800" :
                        app.total_score >= 60 ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {Math.round(app.total_score)}%
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm ${getStageColor(getApplicationStage(app))}`}>
                      {getStageDisplayName(getApplicationStage(app))}
                    </span>
                    {/* Show decision type if in decision stage */}
                    {app.candidate_decision && (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        app.candidate_decision === 'offered' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {app.candidate_decision === 'offered' ? '💼 Oferta' : '❌ Odrzucenie'}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold">{app.job_positions.title}</p>
                    <p className="text-sm text-gray-600">{app.job_positions.department}</p>
                  </div>
                  <p className="text-sm text-gray-500">
                    Aplikacja: {new Date(app.applied_at || "").toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  {app.candidates.phone && (
                    <span>📞 {app.candidates.phone}</span>
                  )}
                  {app.candidates.linkedin_url && (
                    <a
                      href={app.candidates.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      💼 LinkedIn
                    </a>
                  )}
                  {app.candidates.portfolio_url && (
                    <a
                      href={app.candidates.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      🌐 Portfolio
                    </a>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/candidates/${app.id}`}>
                    <Button variant="outline" size="sm">
                      👤 Profil kandydata
                    </Button>
                  </Link>
                  <Link href={`/dashboard?position=${app.job_position_id}`}>
                    <Button variant="outline" size="sm">
                      📊 Zobacz w kanban
                    </Button>
                  </Link>
                  {app.cv_file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(app.cv_file_url, '_blank');
                      }}
                    >
                      📄 Pobierz CV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}