"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

interface Requirement {
  skill: string;
  level: string;
  weight: number;
}

export default function NewPosition() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    workMode: "hybrid",
    experienceLevel: "mid",
    contractType: "b2b",
    companyDescription: "",
    roleDescription: "",
    responsibilities: "",
    qualifications: "",
    offer: "",
    mustHave: [] as Requirement[],
    niceToHave: [] as Requirement[],
  });
  const [newRequirement, setNewRequirement] = useState<Requirement>({
    skill: "",
    level: "regular",
    weight: 5,
  });
  const [requirementType, setRequirementType] = useState<"must" | "nice">("must");

  const addRequirement = () => {
    if (!newRequirement.skill) return;

    if (requirementType === "must") {
      setFormData({
        ...formData,
        mustHave: [...formData.mustHave, newRequirement],
      });
    } else {
      setFormData({
        ...formData,
        niceToHave: [...formData.niceToHave, newRequirement],
      });
    }

    setNewRequirement({ skill: "", level: "regular", weight: 5 });
  };

  const removeRequirement = (type: "must" | "nice", index: number) => {
    if (type === "must") {
      setFormData({
        ...formData,
        mustHave: formData.mustHave.filter((_, i) => i !== index),
      });
    } else {
      setFormData({
        ...formData,
        niceToHave: formData.niceToHave.filter((_, i) => i !== index),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Combine all text fields into description
      const fullDescription = `
**O firmie:**
${formData.companyDescription}

**Opis stanowiska:**
${formData.roleDescription}

**Kluczowe obowiązki:**
${formData.responsibilities}

**Kwalifikacje:**
${formData.qualifications}

**Oferujemy:**
${formData.offer}

**Lokalizacja:** ${formData.location}
**Tryb pracy:** ${formData.workMode}
**Poziom doświadczenia:** ${formData.experienceLevel}
**Typ umowy:** ${formData.contractType}
      `.trim();

      // Insert job position
      const { data: position, error: posError } = await supabase
        .from("job_positions")
        .insert({
          title: formData.title,
          department: formData.department,
          description: fullDescription,
          requirements_must_have: formData.mustHave,
          requirements_nice_to_have: formData.niceToHave,
          scoring_formula: {
            must_have_weight: 0.7,
            nice_to_have_weight: 0.3,
            experience_level: formData.experienceLevel,
            contract_type: formData.contractType,
            work_mode: formData.workMode,
            location: formData.location,
          },
          status: "published",
          organization_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        })
        .select()
        .single();

      if (posError) throw posError;

      // Create default recruitment stages
      const stages = [
        { name: "Nowe aplikacje", order_index: 0, type: "initial" },
        { name: "Screening CV", order_index: 1, type: "screening" },
        { name: "Zadanie rekrutacyjne", order_index: 2, type: "task" },
        { name: "Rozmowa techniczna", order_index: 3, type: "interview" },
        { name: "Rozmowa z HR", order_index: 4, type: "interview" },
        { name: "Decyzja", order_index: 5, type: "final" },
      ];

      const { error: stagesError } = await supabase
        .from("recruitment_stages")
        .insert(
          stages.map((stage) => ({
            ...stage,
            job_position_id: position.id,
          }))
        );

      if (stagesError) throw stagesError;

      router.push("/positions");
    } catch (error) {
      console.error("Error creating position:", error);
      alert("Błąd podczas tworzenia stanowiska");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dodaj nowe stanowisko</h1>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Podstawowe informacje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Nazwa stanowiska</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="np. Analityk danych"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="department">Dział</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="np. Data"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Lokalizacja</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="np. Wrocław"
                  />
                </div>

                <div>
                  <Label htmlFor="workMode">Tryb pracy</Label>
                  <select
                    id="workMode"
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.workMode}
                    onChange={(e) => setFormData({ ...formData, workMode: e.target.value })}
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="experienceLevel">Poziom doświadczenia</Label>
                  <select
                    id="experienceLevel"
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.experienceLevel}
                    onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                  >
                    <option value="junior">Junior</option>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead/Expert</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="contractType">Typ umowy</Label>
                  <select
                    id="contractType"
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.contractType}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                  >
                    <option value="b2b">B2B</option>
                    <option value="uop">Umowa o pracę</option>
                    <option value="uod">Umowa o dzieło</option>
                    <option value="uz">Umowa zlecenie</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Opis stanowiska</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyDescription">O firmie</Label>
                <Textarea
                  id="companyDescription"
                  value={formData.companyDescription}
                  onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                  placeholder="Opisz firmę, kulturę organizacyjną, misję..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="roleDescription">Opis stanowiska</Label>
                <Textarea
                  id="roleDescription"
                  value={formData.roleDescription}
                  onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                  placeholder="Opisz czym będzie zajmować się osoba na tym stanowisku..."
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="responsibilities">Kluczowe obowiązki</Label>
                <Textarea
                  id="responsibilities"
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  placeholder="• Gromadzenie i analiza danych&#10;• Tworzenie raportów&#10;• Współpraca z zespołem..."
                  rows={5}
                  required
                />
              </div>

              <div>
                <Label htmlFor="qualifications">Kwalifikacje</Label>
                <Textarea
                  id="qualifications"
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  placeholder="• Wykształcenie wyższe&#10;• Doświadczenie w branży&#10;• Znajomość narzędzi..."
                  rows={5}
                />
              </div>

              <div>
                <Label htmlFor="offer">Oferujemy</Label>
                <Textarea
                  id="offer"
                  value={formData.offer}
                  onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                  placeholder="• Atrakcyjne wynagrodzenie&#10;• Praca zdalna&#10;• Rozwój zawodowy..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Tech Stack / Wymagania techniczne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 border rounded-md"
                    value={requirementType}
                    onChange={(e) => setRequirementType(e.target.value as "must" | "nice")}
                  >
                    <option value="must">Must Have</option>
                    <option value="nice">Nice to Have</option>
                  </select>
                  <Input
                    placeholder="Umiejętność (np. SQL, Python, AWS)"
                    value={newRequirement.skill}
                    onChange={(e) => setNewRequirement({ ...newRequirement, skill: e.target.value })}
                    className="flex-1"
                  />
                  <select
                    className="px-3 py-2 border rounded-md"
                    value={newRequirement.level}
                    onChange={(e) => setNewRequirement({ ...newRequirement, level: e.target.value })}
                  >
                    <option value="basic">Podstawowy</option>
                    <option value="regular">Regular</option>
                    <option value="advanced">Zaawansowany</option>
                    <option value="expert">Expert</option>
                  </select>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={newRequirement.weight}
                    onChange={(e) => setNewRequirement({ ...newRequirement, weight: parseInt(e.target.value) })}
                    className="w-20"
                    placeholder="Waga"
                  />
                  <Button type="button" onClick={addRequirement}>
                    Dodaj
                  </Button>
                </div>
              </div>

              {formData.mustHave.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Must Have:</h4>
                  <div className="space-y-2">
                    {formData.mustHave.map((req, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-red-50 p-2 rounded">
                        <span>
                          {req.skill} - {req.level} (waga: {req.weight})
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRequirement("must", idx)}
                        >
                          ❌
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.niceToHave.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Nice to Have:</h4>
                  <div className="space-y-2">
                    {formData.niceToHave.map((req, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-green-50 p-2 rounded">
                        <span>
                          {req.skill} - {req.level} (waga: {req.weight})
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRequirement("nice", idx)}
                        >
                          ❌
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Tworzenie..." : "Stwórz stanowisko"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Anuluj
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}