"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { Users, CheckSquare, User, Building2 } from "lucide-react";

interface Application {
  id: string;
  contract_generated: boolean;
  candidate: {
    full_name: string;
    email: string;
    phone?: string;
  };
  job_position: {
    title: string;
    department?: string;
  };
  decision_made_at: string;
}

interface OnboardingTask {
  id: string;
  application_id: string;
  task_name: string;
  completed: boolean;
}

const DEFAULT_ONBOARDING_TASKS = [
  "Szkolenie BHP",
  "Szkolenie IT Security",
  "Wprowadzenie do kultury firmy",
  "Spotkanie z zespołem",
  "Przydzielenie pierwszych zadań"
];

export default function OnboardingPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplicationsWithContracts();
  }, []);

  const fetchApplicationsWithContracts = async () => {
    try {
      // Fetch applications with generated contracts
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          id,
          contract_generated,
          decision_made_at,
          candidate:candidates(full_name, email, phone),
          job_position:job_positions(title, department)
        `)
        .eq('candidate_decision', 'offered')
        .eq('contract_generated', true)
        .order('decision_made_at', { ascending: false });

      if (appsError) throw appsError;

      const apps = appsData || [];
      setApplications(apps);

      // Fetch existing onboarding tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .in('application_id', apps.map(app => app.id));

      if (tasksError) throw tasksError;

      let tasks = tasksData || [];

      // Create default tasks for applications that don't have any tasks yet
      const appsWithoutTasks = apps.filter(app =>
        !tasks.some(task => task.application_id === app.id)
      );

      for (const app of appsWithoutTasks) {
        const defaultTasks = DEFAULT_ONBOARDING_TASKS.map(taskName => ({
          application_id: app.id,
          task_name: taskName,
          completed: false
        }));

        const { data: newTasks, error: insertError } = await supabase
          .from('onboarding_tasks')
          .insert(defaultTasks)
          .select();

        if (insertError) throw insertError;
        if (newTasks) {
          tasks.push(...newTasks);
        }
      }

      setOnboardingTasks(tasks);
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('onboarding_tasks')
        .update({ completed })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setOnboardingTasks(tasks =>
        tasks.map(task =>
          task.id === taskId ? { ...task, completed } : task
        )
      );
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getTasksForApplication = (applicationId: string) => {
    return onboardingTasks.filter(task => task.application_id === applicationId);
  };

  const getCompletedTasksCount = (applicationId: string) => {
    const tasks = getTasksForApplication(applicationId);
    return tasks.filter(task => task.completed).length;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Ładowanie onboardingu...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold">Onboarding</h1>
          <p className="text-gray-600">Proces wdrażania nowych pracowników</p>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Brak pracowników do wdrożenia</p>
            <p className="text-sm text-gray-400">Pracownicy z wygenerowanymi umowami pojawią się tutaj automatycznie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => {
            const tasks = getTasksForApplication(app.id);
            const completedCount = getCompletedTasksCount(app.id);
            const totalTasks = tasks.length;
            const completionPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

            return (
              <Card key={app.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-green-600" />
                      <div>
                        <div>{app.candidate.full_name}</div>
                        <div className="text-sm font-normal text-gray-600">
                          {app.job_position.title}
                          {app.job_position.department && ` • ${app.job_position.department}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        completionPercentage === 100 ? 'bg-green-100 text-green-800' :
                        completionPercentage > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {completedCount}/{totalTasks} zadań ukończonych
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${completionPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <div>{app.candidate.email}</div>
                      </div>
                      {app.candidate.phone && (
                        <div>
                          <span className="text-gray-500">Telefon:</span>
                          <div>{app.candidate.phone}</div>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Data zatrudnienia:</span>
                        <div>{new Date(app.decision_made_at).toLocaleDateString('pl-PL')}</div>
                      </div>
                    </div>

                    {/* Onboarding Tasks */}
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium">Lista zadań onboardingu:</h4>
                      </div>

                      <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-3">
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={task.completed}
                              onCheckedChange={(checked) => toggleTask(task.id, checked as boolean)}
                            />
                            <label
                              htmlFor={`task-${task.id}`}
                              className={`text-sm cursor-pointer ${
                                task.completed ? 'line-through text-gray-500' : ''
                              }`}
                            >
                              {task.task_name}
                            </label>
                          </div>
                        ))}
                      </div>

                      {completionPercentage === 100 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-green-800 text-sm">
                            ✅ <strong>Onboarding ukończony!</strong> Pracownik jest gotowy do pełnej pracy.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}