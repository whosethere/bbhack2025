"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database";

type JobPosition = Database["public"]["Tables"]["job_positions"]["Row"];

interface CVData {
  fullName: string;
  email: string;
  phone: string;
  github: string;
  languages: string[];
  technologies: string[];
  experience: string;
  education: string;
}

export default function UploadCandidate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const positionId = searchParams.get("position");

  const [position, setPosition] = useState<JobPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CVData | null>(null);
  const [autoParseEnabled, setAutoParseEnabled] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    portfolioUrl: "",
    notes: "",
    city: "",
    experienceYears: "",
    education: "",
  });
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [newTech, setNewTech] = useState("");

  useEffect(() => {
    if (positionId) {
      fetchPosition();
    }
  }, [positionId]);

  const fetchPosition = async () => {
    if (!positionId) return;

    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("id", positionId)
        .single();

      if (error) throw error;
      setPosition(data);
    } catch (error) {
      console.error("Error fetching position:", error);
    }
  };

  const parseCV = async (file: File) => {
    setParsing(true);
    console.log("Starting CV parsing for:", file.name);

    try {
      const fileFormData = new FormData();
      fileFormData.append("file", file);

      console.log("Sending request to /api/parse-cv");
      const response = await fetch("/api/parse-cv", {
        method: "POST",
        body: fileFormData,
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("API result:", result);

      if (result.success && result.data) {
        setParsedData(result.data);

        // Auto-fill form with parsed data
        setFormData(prev => ({
          ...prev,
          fullName: result.data.fullName || prev.fullName,
          email: result.data.email || prev.email,
          phone: result.data.phone || prev.phone,
          portfolioUrl: result.data.github || prev.portfolioUrl,
          city: result.pythonResponse?.miasto || prev.city,
          experienceYears: result.pythonResponse?.ile_lat_doswiadczenia?.toString() || prev.experienceYears,
          education: result.data.education || prev.education,
        }));

        // Set technologies from AI
        if (result.data.technologies && result.data.technologies.length > 0) {
          setTechnologies(result.data.technologies);
        }

        alert("✅ CV zostało automatycznie przeanalizowane!");
      } else {
        throw new Error(result.error || "Failed to parse CV");
      }
    } catch (error) {
      console.error("CV parsing error:", error);
      alert(`⚠️ Błąd parsingu CV: ${error instanceof Error ? error.message : "Unknown error"}. Wypełnij formularz ręcznie.`);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file is PDF
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert("Proszę wybrać plik w formacie PDF. Inne formaty nie są obecnie obsługiwane przez nowe API.");
        e.target.value = '';
        return;
      }

      setCvFile(file);
      setParsedData(null); // Clear previous data

      // Auto-fill candidate name from filename if no parsed data
      if (!parsedData && !formData.fullName) {
        const nameFromFile = file.name
          .replace(/\.(pdf)$/i, "")
          .replace(/[_-]/g, " ")
          .replace(/cv|resume/gi, "")
          .trim();

        if (nameFromFile.length > 2) {
          setFormData(prev => ({ ...prev, fullName: nameFromFile }));
        }
      }

      // Only auto-parse if enabled
      if (autoParseEnabled) {
        parseCV(file);
      }
    }
  };

  const addTechnology = () => {
    if (newTech.trim() && !technologies.includes(newTech.trim())) {
      setTechnologies([...technologies, newTech.trim()]);
      setNewTech("");
    }
  };

  const removeTechnology = (tech: string) => {
    setTechnologies(technologies.filter(t => t !== tech));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionId || !cvFile) return;

    setLoading(true);

    try {
      // First, check if candidate exists by email
      let candidateId: string;
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", formData.email)
        .single();

      if (existingCandidate) {
        candidateId = existingCandidate.id;
      } else {
        // Create new candidate
        const { data: newCandidate, error: candidateError } = await supabase
          .from("candidates")
          .insert({
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            linkedin_url: formData.linkedinUrl,
            portfolio_url: formData.portfolioUrl,
          })
          .select("id")
          .single();

        if (candidateError) throw candidateError;
        candidateId = newCandidate.id;
      }

      // Upload CV file to Supabase Storage
      const fileName = `${candidateId}_${Date.now()}_${cvFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("cv-files")
        .upload(fileName, cvFile);

      if (uploadError) {
        console.warn("Storage upload failed, continuing without file:", uploadError);
      }

      const cvUrl = uploadError ? null : `cv-files/${fileName}`;

      // Get the first stage (initial) for this position
      const { data: initialStage } = await supabase
        .from("recruitment_stages")
        .select("id")
        .eq("job_position_id", positionId)
        .eq("type", "initial")
        .order("order_index")
        .limit(1)
        .single();

      // Create application with parsed CV data
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          job_position_id: positionId,
          candidate_id: candidateId,
          current_stage_id: initialStage?.id,
          status: "in_progress",
          cv_file_url: cvUrl,
          cv_parsed_data: {
            notes: formData.notes,
            uploaded_at: new Date().toISOString(),
            file_name: cvFile.name,
            // Store parsed CV data for later scoring
            ai_extracted: parsedData ? {
              languages: parsedData.languages,
              technologies: technologies.length > 0 ? technologies : parsedData.technologies,
              experience: parsedData.experience,
              education: parsedData.education,
            } : { technologies },
          },
        })
        .select("id")
        .single();

      if (appError) throw appError;

      // Add to stage history
      if (initialStage) {
        await supabase
          .from("stage_history")
          .insert({
            application_id: application.id,
            stage_id: initialStage.id,
          });
      }

      // Log activity
      await supabase
        .from("activity_logs")
        .insert({
          entity_type: "application",
          entity_id: application.id,
          action: "created",
          details: {
            candidate_name: formData.fullName,
            position_title: position?.title,
            ai_parsed: !!parsedData,
          },
        });

      router.push(`/dashboard?position=${positionId}`);
    } catch (error) {
      console.error("Error creating application:", error);
      alert("Błąd podczas dodawania kandydata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Dodaj kandydata</h1>
          {position && (
            <p className="text-gray-600">
              Stanowisko: <span className="font-semibold">{position.title}</span>
              {position.department && ` • ${position.department}`}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                CV kandydata
                {parsing && <span className="text-sm text-blue-600">Analizuję CV...</span>}
                {parsedData && <span className="text-sm text-green-600">✅ Przeanalizowane</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cv">Plik CV (tylko PDF)</Label>
                  <Input
                    id="cv"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    required
                    className="mt-1"
                    disabled={parsing}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obsługujemy obecnie tylko pliki PDF dla najlepszej jakości analizy AI
                  </p>
                </div>

                {cvFile && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          📄 {cvFile.name}
                        </p>
                        <p className="text-xs text-green-600">
                          {Math.round(cvFile.size / 1024)} KB • Gotowe do analizy
                        </p>
                      </div>
                      {!parsedData && !parsing && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => parseCV(cvFile)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Odczytaj dane z CV
                        </Button>
                      )}
                    </div>
                    {parsing && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <p className="text-sm text-blue-600">
                          Analizuję CV przy pomocy AI... może to potrwać kilka sekund
                        </p>
                      </div>
                    )}
                    {parsedData && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-green-600">✅</span>
                        <p className="text-sm text-green-600">
                          CV zostało przeanalizowane! Dane zostały automatycznie wypełnione w formularzu.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Show parsed data preview */}
          {parsedData && (
            <Card className="mb-6 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800">Dane wyextraktowane przez AI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid md:grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg">
                  <div>
                    <Label className="font-semibold text-blue-800">Imię i nazwisko:</Label>
                    <p className="text-sm">{parsedData.fullName || "Nie wykryto"}</p>
                  </div>
                  <div>
                    <Label className="font-semibold text-blue-800">Email:</Label>
                    <p className="text-sm">{parsedData.email || "Nie wykryto"}</p>
                  </div>
                  <div>
                    <Label className="font-semibold text-blue-800">Telefon:</Label>
                    <p className="text-sm">{parsedData.phone || "Nie wykryto"}</p>
                  </div>
                  <div>
                    <Label className="font-semibold text-blue-800">Doświadczenie:</Label>
                    <p className="text-sm">{parsedData.experience || "Nie wykryto"}</p>
                  </div>
                </div>

                {/* Technologies */}
                {parsedData.technologies.length > 0 && (
                  <div>
                    <Label className="font-semibold">Technologie ({parsedData.technologies.length}):</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parsedData.technologies.map((tech, idx) => (
                        <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Soft Skills/Languages as detected by AI */}
                {parsedData.languages.length > 0 && (
                  <div>
                    <Label className="font-semibold">Umiejętności miękkie:</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parsedData.languages.map((skill, idx) => (
                        <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.education && (
                  <div>
                    <Label className="font-semibold">Wykształcenie:</Label>
                    <p className="text-sm text-gray-700 p-2 bg-gray-50 rounded">{parsedData.education}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Dane kandydata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Imię i nazwisko</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="np. Jan Kowalski"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jan.kowalski@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+48 123 456 789"
                  />
                </div>

                <div>
                  <Label htmlFor="city">Miasto</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="np. Warszawa"
                  />
                </div>

                <div>
                  <Label htmlFor="experienceYears">Lata doświadczenia</Label>
                  <Input
                    id="experienceYears"
                    type="number"
                    min="0"
                    max="50"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                    placeholder="np. 5"
                  />
                </div>

                <div>
                  <Label htmlFor="education">Wykształcenie</Label>
                  <Input
                    id="education"
                    value={formData.education}
                    onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    placeholder="np. Wykształcenie wyższe"
                  />
                </div>

                <div>
                  <Label htmlFor="linkedinUrl">LinkedIn</Label>
                  <Input
                    id="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="portfolioUrl">Portfolio / GitHub</Label>
                <Input
                  id="portfolioUrl"
                  value={formData.portfolioUrl}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  placeholder="https://github.com/... lub portfolio"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notatki rekrutera</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Dodatkowe uwagi, źródło aplikacji, itp."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Technologie kandydata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    placeholder="np. React, Python, AWS..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                  />
                  <Button type="button" onClick={addTechnology}>
                    Dodaj
                  </Button>
                </div>

                {technologies.length > 0 && (
                  <div>
                    <Label className="font-semibold">Znane technologie:</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {technologies.map((tech, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                        >
                          {tech}
                          <button
                            type="button"
                            onClick={() => removeTechnology(tech)}
                            className="text-blue-600 hover:text-blue-800 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {technologies.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Dodaj technologie które zna kandydat. AI może automatycznie je wyekstraktować z CV.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading || parsing} className="flex-1">
              {loading ? "Dodawanie..." : parsing ? "Czekam na analizę AI..." : "Dodaj kandydata"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading || parsing}
            >
              Anuluj
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}