import Link from "next/link";
import {
  Users,
  Briefcase,
  UserPlus,
  Video,
  BarChart3,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Recruitment Hub
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Comprehensive AI-powered recruitment system that supports the entire hiring cycle - from CV analysis to employee onboarding.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-12">
          <Link
            href="/positions/new"
            className="group bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 p-6 rounded-xl border border-blue-200 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500 rounded-lg text-white group-hover:bg-blue-600 transition-colors">
                <Briefcase size={24} />
              </div>
              <ArrowRight size={20} className="text-blue-500 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Position</h3>
            <p className="text-sm text-gray-600">Post a new job with AI-powered requirements</p>
          </Link>

          <Link
            href="/dashboard"
            className="group bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 p-6 rounded-xl border border-green-200 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500 rounded-lg text-white group-hover:bg-green-600 transition-colors">
                <BarChart3 size={24} />
              </div>
              <ArrowRight size={20} className="text-green-500 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard</h3>
            <p className="text-sm text-gray-600">Monitor recruitment pipeline</p>
          </Link>

          <Link
            href="/candidates/upload"
            className="group bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 p-6 rounded-xl border border-purple-200 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500 rounded-lg text-white group-hover:bg-purple-600 transition-colors">
                <UserPlus size={24} />
              </div>
              <ArrowRight size={20} className="text-purple-500 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Candidate</h3>
            <p className="text-sm text-gray-600">Upload CV with AI analysis</p>
          </Link>

          <Link
            href="/interview"
            className="group bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 p-6 rounded-xl border border-orange-200 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500 rounded-lg text-white group-hover:bg-orange-600 transition-colors">
                <Video size={24} />
              </div>
              <ArrowRight size={20} className="text-orange-500 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Interview</h3>
            <p className="text-sm text-gray-600">Conduct AI-powered interviews</p>
          </Link>
        </div>

        {/* Features Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">AI-Powered CV Analysis</h4>
                  <p className="text-sm text-gray-600">Automatic parsing and scoring of candidate resumes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">Smart Candidate Matching</h4>
                  <p className="text-sm text-gray-600">AI-driven matching between candidates and positions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">Kanban Pipeline</h4>
                  <p className="text-sm text-gray-600">Visual recruitment pipeline management</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">Video Interviews</h4>
                  <p className="text-sm text-gray-600">AI-conducted video interviews for soft skills assessment</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">Automated Communication</h4>
                  <p className="text-sm text-gray-600">Smart notifications and candidate feedback</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-900">Onboarding Automation</h4>
                  <p className="text-sm text-gray-600">Streamlined new employee introduction process</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}