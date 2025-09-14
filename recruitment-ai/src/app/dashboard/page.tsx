"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";
import {
  Calendar,
  Filter,
  Download,
  Plus,
  Clock,
  Users,
  Briefcase,
  MoreHorizontal,
  Eye
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type JobPosition = Database["public"]["Tables"]["job_positions"]["Row"];

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
  candidate?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  job_position?: {
    id: string;
    title: string;
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

interface StageConfig {
  id: RecruitmentStage;
  name: string;
  description: string;
  color: string;
}

const RECRUITMENT_STAGES: StageConfig[] = [
  {
    id: 'new_applications',
    name: 'Nowe aplikacje',
    description: 'Kandydaci z przesłanymi CV, oczekują na screening',
    color: 'bg-blue-100 border-blue-200 text-blue-800'
  },
  {
    id: 'cv_screening',
    name: 'Screening CV',
    description: 'CV zostało ocenione, oczekują na AI interview',
    color: 'bg-yellow-100 border-yellow-200 text-yellow-800'
  },
  {
    id: 'ai_interview',
    name: 'AI Interview',
    description: 'Zakończyli AI interview, oczekują na zadanie rekrutacyjne',
    color: 'bg-purple-100 border-purple-200 text-purple-800'
  },
  {
    id: 'recruitment_task',
    name: 'Zadanie rekrutacyjne',
    description: 'Otrzymali/ukończyli zadanie, oczekują na decyzję',
    color: 'bg-orange-100 border-orange-200 text-orange-800'
  },
  {
    id: 'decision',
    name: 'Decyzja',
    description: 'Podjęto finalną decyzję (oferta lub odrzucenie)',
    color: 'bg-green-100 border-green-200 text-green-800'
  }
];

const CHART_COLORS = ['#3B82F6', '#EAB308', '#8B5CF6', '#F97316', '#6366F1', '#10B981'];

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

export default function Dashboard() {
  const searchParams = useSearchParams();
  const selectedPositionId = searchParams.get("position");

  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    if (selectedPositionId) {
      const position = positions.find(p => p.id === selectedPositionId);
      if (position) {
        setSelectedPosition(position);
        fetchApplications(selectedPositionId);
      }
    } else if (positions.length > 0) {
      setSelectedPosition(positions[0]);
      fetchApplications(positions[0].id);
    }
  }, [selectedPositionId, positions]);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error("Error fetching positions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async (positionId: string) => {
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
          candidate:candidates(full_name, email, phone),
          job_position:job_positions(id, title, requirements_must_have, requirements_nice_to_have, scoring_formula),
          interviews(id, status, ai_insights, transcript, notes, created_at)
        `)
        .eq('job_position_id', positionId);

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error fetching applications:", error);
    }
  };

  // Group applications by stage
  const applicationsByStage = RECRUITMENT_STAGES.map(stage => {
    const stageApplications = applications.filter(app => getApplicationStage(app) === stage.id);
    return {
      stage,
      applications: stageApplications,
      count: stageApplications.length
    };
  });

  // Calculate summary data
  const totalApplications = applications.length;
  const chartData = applicationsByStage.map((stageGroup, index) => ({
    name: stageGroup.stage.name,
    value: stageGroup.count,
    color: CHART_COLORS[index % CHART_COLORS.length]
  })).filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="p-8">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="py-8">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No active positions found</p>
            <Button onClick={() => window.location.href = "/positions/new"}>
              Create First Position
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-500">Today is {today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-2 rounded-lg border">
              <Calendar size={16} />
              Feb 18 — Nov 18
            </div>
            <select className="bg-white border rounded-lg px-3 py-2 text-sm">
              <option>Monthly</option>
            </select>
            <Button variant="outline" size="sm">
              <Filter size={16} className="mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Hiring Pipeline */}
          <div className="col-span-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">Hiring</h2>
                <select
                  className="bg-white border rounded-lg px-3 py-2 text-sm"
                  value={selectedPosition?.id || ""}
                  onChange={(e) => {
                    const position = positions.find(p => p.id === e.target.value);
                    setSelectedPosition(position || null);
                    if (position) fetchKanbanData(position.id);
                  }}
                >
                  {positions.map(position => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" size="sm">
                <Eye size={16} className="mr-2" />
                VIEW ALL
              </Button>
            </div>

            {/* Position Header */}
            {selectedPosition && (
              <div className="bg-white rounded-lg p-4 mb-4 border">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedPosition.title}</h3>
                    <p className="text-sm text-gray-500">TOTAL APPLICATION {totalApplications}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = `/candidates/upload?position=${selectedPosition.id}`}
                  >
                    <Plus size={16} className="mr-2" />
                    Add Candidate
                  </Button>
                </div>
              </div>
            )}

            {/* Recruitment Pipeline */}
            <div className="grid grid-cols-5 gap-4">
              {applicationsByStage.map((stageGroup, index) => {
                return (
                  <div key={stageGroup.stage.id} className="space-y-2">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {stageGroup.stage.name}
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${stageGroup.stage.color}`}>
                        {stageGroup.count} Kandydatów
                      </div>
                    </div>

                    <div className="space-y-2 min-h-[300px]">
                      {stageGroup.applications.map((app) => (
                        <div
                          key={app.id}
                          className="bg-white rounded-lg p-3 border hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {app.candidate?.full_name || 'Nieznany kandydat'}
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            {app.candidate?.email || ''}
                          </div>
                          {app.total_score && (
                            <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                              app.total_score >= 80 ? "bg-green-100 text-green-800" :
                              app.total_score >= 60 ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {Math.round(app.total_score)}%
                            </div>
                          )}
                          {/* Show additional stage-specific info */}
                          {stageGroup.stage.id === 'recruitment_task' && app.recruitment_task_status && (
                            <div className="text-xs text-purple-600 mt-1">
                              {app.recruitment_task_status === 'task_sent' ? 'Zadanie wysłane' : 'Zadanie ukończone'}
                            </div>
                          )}
                          {stageGroup.stage.id === 'decision' && app.candidate_decision && (
                            <div className={`text-xs mt-1 ${
                              app.candidate_decision === 'offered' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {app.candidate_decision === 'offered' ? 'Oferta' : 'Odrzucenie'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-4 space-y-6">
            {/* Jobs Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Jobs Summary</CardTitle>
                <MoreHorizontal size={16} className="text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold">{totalApplications}</div>
                      <div className="text-xs text-gray-500">APPLICATIONS</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold">{positions.length}</div>
                    <div className="text-xs text-gray-500">PUBLISHED</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">0</div>
                    <div className="text-xs text-gray-500">ON HOLD</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">0</div>
                    <div className="text-xs text-gray-500">INTERNAL</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">0</div>
                    <div className="text-xs text-gray-500">CLOSED</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* My Tasks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">My Task</CardTitle>
                <div className="flex items-center gap-2">
                  <select className="text-sm border rounded px-2 py-1">
                    <option>Today</option>
                  </select>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar size={14} />
                    Feb 18 — Nov 18
                  </div>
                  <Button size="sm" variant="outline">
                    <Plus size={14} className="mr-1" />
                    ADD TASK
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { time: "09:00 — 10:00 AM", task: "Interview with candidates from product designer application", color: "border-l-purple-400" },
                    { time: "10:30 — 12:00 AM", task: "UI Design candidate screening", color: "border-l-pink-400" },
                    { time: "13:30 — 14:00 PM", task: "Submit freelance recruitment result", color: "border-l-yellow-400" },
                    { time: "14:00 — 16:00 PM", task: "Make new career vacancy", color: "border-l-green-400" },
                    { time: "16:30 — 18:00 PM", task: "Conduct test for UX Researcher candidates", color: "border-l-blue-400" },
                  ].map((task, index) => (
                    <div key={index} className={`flex items-start gap-3 p-3 border-l-4 ${task.color} bg-gray-50 rounded-r-lg`}>
                      <Clock size={16} className="text-gray-400 mt-1" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{task.time}</div>
                        <div className="text-sm text-gray-600 mt-1">{task.task}</div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Employee Teams */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Employee</CardTitle>
                <Button size="sm" variant="outline">
                  VIEW ALL
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { team: "Design Team", members: 24, avatars: ["👨‍💻", "👩‍💻", "👨‍🎨"] },
                    { team: "Development Team", members: 18, avatars: ["👨‍💻", "👩‍💻", "👨‍💼"] },
                    { team: "Finance Team", members: 12, avatars: ["👩‍💼", "👨‍💼", "👩‍💻"] },
                    { team: "Sales Team", members: 27, avatars: ["👨‍💼", "👩‍💼", "👨‍💻"] },
                  ].map((team, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {team.avatars.map((avatar, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm border-2 border-white">
                              {avatar}
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="font-medium">{team.team}</div>
                          <div className="text-sm text-gray-500">TOTAL MEMBER {team.members}</div>
                        </div>
                      </div>
                      <div className="text-sm font-medium">+{team.members}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}