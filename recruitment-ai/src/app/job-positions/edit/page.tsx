"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface JobPosition {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements_must_have: Array<{
    skill: string;
    level: "basic" | "regular" | "advanced";
    weight: number;
  }>;
  requirements_nice_to_have: Array<{
    skill: string;
    level: "basic" | "regular" | "advanced";
    weight: number;
  }>;
  scoring_formula: {
    must_have_weight: number;
    nice_to_have_weight: number;
    location?: string;
    work_mode?: string;
    contract_type?: string;
    experience_level?: string;
  };
}

export default function EditJobPositionPage() {
  const [jobPosition, setJobPosition] = useState<JobPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMustHaveSkill, setNewMustHaveSkill] = useState("");
  const [newNiceToHaveSkill, setNewNiceToHaveSkill] = useState("");

  useEffect(() => {
    fetchJobPosition();
  }, []);

  const fetchJobPosition = async () => {
    try {
      const { data, error } = await supabase
        .from('job_positions')
        .select('*')
        .eq('status', 'published')
        .single();

      if (error) throw error;
      setJobPosition(data);
    } catch (error) {
      console.error('Error fetching job position:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobPosition = async () => {
    if (!jobPosition) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('job_positions')
        .update({
          title: jobPosition.title,
          department: jobPosition.department,
          description: jobPosition.description,
          requirements_must_have: jobPosition.requirements_must_have,
          requirements_nice_to_have: jobPosition.requirements_nice_to_have,
          scoring_formula: jobPosition.scoring_formula,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobPosition.id);

      if (error) throw error;

      alert('Oferta pracy została zaktualizowana!');
    } catch (error) {
      console.error('Error updating job position:', error);
      alert('Błąd podczas aktualizacji');
    } finally {
      setSaving(false);
    }
  };

  const addMustHaveSkill = () => {
    if (!newMustHaveSkill.trim() || !jobPosition) return;

    setJobPosition({
      ...jobPosition,
      requirements_must_have: [
        ...jobPosition.requirements_must_have,
        { skill: newMustHaveSkill, level: "regular", weight: 5 }
      ]
    });
    setNewMustHaveSkill("");
  };

  const addNiceToHaveSkill = () => {
    if (!newNiceToHaveSkill.trim() || !jobPosition) return;

    setJobPosition({
      ...jobPosition,
      requirements_nice_to_have: [
        ...jobPosition.requirements_nice_to_have,
        { skill: newNiceToHaveSkill, level: "regular", weight: 3 }
      ]
    });
    setNewNiceToHaveSkill("");
  };

  const removeMustHaveSkill = (index: number) => {
    if (!jobPosition) return;

    setJobPosition({
      ...jobPosition,
      requirements_must_have: jobPosition.requirements_must_have.filter((_, i) => i !== index)
    });
  };

  const removeNiceToHaveSkill = (index: number) => {
    if (!jobPosition) return;

    setJobPosition({
      ...jobPosition,
      requirements_nice_to_have: jobPosition.requirements_nice_to_have.filter((_, i) => i !== index)
    });
  };

  const updateMustHaveSkill = (index: number, field: string, value: any) => {
    if (!jobPosition) return;

    const updated = [...jobPosition.requirements_must_have];
    updated[index] = { ...updated[index], [field]: value };

    setJobPosition({
      ...jobPosition,
      requirements_must_have: updated
    });
  };

  const updateNiceToHaveSkill = (index: number, field: string, value: any) => {
    if (!jobPosition) return;

    const updated = [...jobPosition.requirements_nice_to_have];
    updated[index] = { ...updated[index], [field]: value };

    setJobPosition({
      ...jobPosition,
      requirements_nice_to_have: updated
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>;
  }

  if (!jobPosition) {
    return <div className="container mx-auto p-6">Nie znaleziono oferty pracy do edycji.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Edycja Oferty Pracy</h1>
        <p className="text-gray-600">Skonfiguruj wymagania i wagę umiejętności dla lepszej oceny kandydatów.</p>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Podstawowe informacje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Nazwa stanowiska</Label>
              <Input
                id="title"
                value={jobPosition.title}
                onChange={(e) => setJobPosition({...jobPosition, title: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="department">Departament</Label>
              <Input
                id="department"
                value={jobPosition.department || ""}
                onChange={(e) => setJobPosition({...jobPosition, department: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="description">Opis stanowiska</Label>
              <Textarea
                id="description"
                value={jobPosition.description || ""}
                onChange={(e) => setJobPosition({...jobPosition, description: e.target.value})}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Must Have Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Wymagania Must-Have (70% wagi)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobPosition.requirements_must_have.map((req, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Input
                    value={req.skill}
                    onChange={(e) => updateMustHaveSkill(index, 'skill', e.target.value)}
                    placeholder="Nazwa umiejętności"
                  />
                </div>
                <div className="w-32">
                  <Select
                    value={req.level}
                    onValueChange={(value) => updateMustHaveSkill(index, 'level', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Podstawowy</SelectItem>
                      <SelectItem value="regular">Średni</SelectItem>
                      <SelectItem value="advanced">Zaawansowany</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={req.weight}
                    onChange={(e) => updateMustHaveSkill(index, 'weight', parseInt(e.target.value))}
                    placeholder="Waga"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeMustHaveSkill(index)}
                >
                  Usuń
                </Button>
              </div>
            ))}

            <div className="flex items-center space-x-2">
              <Input
                value={newMustHaveSkill}
                onChange={(e) => setNewMustHaveSkill(e.target.value)}
                placeholder="Dodaj nowe wymaganie must-have..."
                onKeyPress={(e) => e.key === 'Enter' && addMustHaveSkill()}
              />
              <Button onClick={addMustHaveSkill}>Dodaj</Button>
            </div>
          </CardContent>
        </Card>

        {/* Nice To Have Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Wymagania Nice-to-Have (30% wagi)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobPosition.requirements_nice_to_have.map((req, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Input
                    value={req.skill}
                    onChange={(e) => updateNiceToHaveSkill(index, 'skill', e.target.value)}
                    placeholder="Nazwa umiejętności"
                  />
                </div>
                <div className="w-32">
                  <Select
                    value={req.level}
                    onValueChange={(value) => updateNiceToHaveSkill(index, 'level', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Podstawowy</SelectItem>
                      <SelectItem value="regular">Średni</SelectItem>
                      <SelectItem value="advanced">Zaawansowany</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={req.weight}
                    onChange={(e) => updateNiceToHaveSkill(index, 'weight', parseInt(e.target.value))}
                    placeholder="Waga"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeNiceToHaveSkill(index)}
                >
                  Usuń
                </Button>
              </div>
            ))}

            <div className="flex items-center space-x-2">
              <Input
                value={newNiceToHaveSkill}
                onChange={(e) => setNewNiceToHaveSkill(e.target.value)}
                placeholder="Dodaj nowe wymaganie nice-to-have..."
                onKeyPress={(e) => e.key === 'Enter' && addNiceToHaveSkill()}
              />
              <Button onClick={addNiceToHaveSkill}>Dodaj</Button>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Formula */}
        <Card>
          <CardHeader>
            <CardTitle>Formuła oceniania</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="must_have_weight">Waga Must-Have (0.0 - 1.0)</Label>
                <Input
                  id="must_have_weight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={jobPosition.scoring_formula.must_have_weight}
                  onChange={(e) => setJobPosition({
                    ...jobPosition,
                    scoring_formula: {
                      ...jobPosition.scoring_formula,
                      must_have_weight: parseFloat(e.target.value)
                    }
                  })}
                />
              </div>
              <div>
                <Label htmlFor="nice_to_have_weight">Waga Nice-to-Have (0.0 - 1.0)</Label>
                <Input
                  id="nice_to_have_weight"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={jobPosition.scoring_formula.nice_to_have_weight}
                  onChange={(e) => setJobPosition({
                    ...jobPosition,
                    scoring_formula: {
                      ...jobPosition.scoring_formula,
                      nice_to_have_weight: parseFloat(e.target.value)
                    }
                  })}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-sm">Aktualna konfiguracja:</h4>
              <ul className="text-sm text-gray-600 mt-2">
                <li>• Must-Have: {(jobPosition.scoring_formula.must_have_weight * 100)}% wagi</li>
                <li>• Nice-to-Have: {(jobPosition.scoring_formula.nice_to_have_weight * 100)}% wagi</li>
                <li>• Doświadczenie + Wykształcenie: {((1 - jobPosition.scoring_formula.must_have_weight - jobPosition.scoring_formula.nice_to_have_weight) * 100)}% wagi</li>
                <li>• Próg kwalifikacji AI: 20 punktów</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={updateJobPosition}
            disabled={saving}
            size="lg"
          >
            {saving ? "Zapisywanie..." : "💾 Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </div>
  );
}